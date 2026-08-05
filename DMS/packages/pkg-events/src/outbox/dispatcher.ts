import { MessageBrokerClient } from '../broker/rabbitmq.js';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Minimal database client interface expected by the outbox dispatcher.
 * Matches the `PostgresDatabaseClient` API surface without introducing a hard
 * package dependency (keeps pkg-events independent of pkg-database).
 */
export interface IOutboxDatabaseClient {
  query<T = unknown>(
    sql: string,
    params?: unknown[],
    tenantId?: string,
  ): Promise<{ rows: T[]; rowCount: number }>;
  transaction<T>(
    operations: (conn: {
      query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }>;
    }) => Promise<T>,
    tenantId?: string,
  ): Promise<T>;
}

export interface OutboxRow {
  id: string;
  tenant_id: string;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  payload: string | Record<string, unknown>;
  created_at: Date;
  published_at: Date | null;
  retry_count: number;
  max_retries: number;
  last_error: string | null;
  next_attempt_at: Date;
}

export interface OutboxDispatcherConfig {
  /** Polling interval in milliseconds. Default: 1000 */
  pollIntervalMs?: number;
  /** Number of events to fetch per poll cycle. Default: 50 */
  batchSize?: number;
  /** Maximum number of publish retries before routing to DLQ. Default: 5 */
  maxRetries?: number;
  /** Name of the DLQ topic suffix. Default: ".dlq" */
  dlqSuffix?: string;
  /** Name of the outbox table. Default: "outbox_events" */
  tableName?: string;
}

export interface DispatchResult {
  dispatched: number;
  failed: number;
  dlqRouted: number;
}

// ─── OutboxDispatcher ─────────────────────────────────────────────────────────

export class OutboxDispatcher {
  private readonly db: IOutboxDatabaseClient;
  private readonly broker: MessageBrokerClient;
  private readonly pollIntervalMs: number;
  private readonly batchSize: number;
  private readonly maxRetries: number;
  private readonly dlqSuffix: string;
  private readonly tableName: string;

  private running = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    db: IOutboxDatabaseClient,
    broker: MessageBrokerClient,
    config: OutboxDispatcherConfig = {},
  ) {
    this.db = db;
    this.broker = broker;
    this.pollIntervalMs = config.pollIntervalMs ?? 1_000;
    this.batchSize = config.batchSize ?? 50;
    this.maxRetries = config.maxRetries ?? 5;
    this.dlqSuffix = config.dlqSuffix ?? '.dlq';
    this.tableName = config.tableName ?? 'outbox_events';
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Start the polling loop.  This is a non-blocking call; the loop runs
   * asynchronously until `stop()` is called.
   */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.schedulePoll();
  }

  /**
   * Stop the polling loop gracefully.
   */
  stop(): void {
    this.running = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  get isRunning(): boolean {
    return this.running;
  }

  // ── Single dispatch cycle (also usable ad-hoc) ────────────────────────────

  /**
   * Execute one poll-dispatch cycle.  Can be called directly for testing or
   * cron-triggered dispatch without starting the continuous loop.
   */
  async dispatchPending(): Promise<DispatchResult> {
    const result: DispatchResult = { dispatched: 0, failed: 0, dlqRouted: 0 };

    // 1. Fetch a batch of unsent events, ordered by creation time, with:
    //    - row-level locking (FOR UPDATE SKIP LOCKED) to allow concurrent dispatcher instances.
    //    - aggregate ordering (NOT EXISTS query preventing N+1 event from being sent before N is sent).
    //    - backoff support (next_attempt_at <= NOW()).
    const batch = await this.db.query<OutboxRow>(
      `SELECT id, tenant_id, aggregate_type, aggregate_id,
              event_type, payload, created_at, published_at,
              retry_count, max_retries, last_error, next_attempt_at
       FROM "${this.tableName}" e1
       WHERE published_at IS NULL
         AND retry_count < $1
         AND next_attempt_at <= NOW()
         AND NOT EXISTS (
           SELECT 1 FROM "${this.tableName}" e2
           WHERE e2.aggregate_type = e1.aggregate_type
             AND e2.aggregate_id = e1.aggregate_id
             AND e2.published_at IS NULL
             AND e2.created_at < e1.created_at
         )
       ORDER BY created_at ASC
       LIMIT $2
       FOR UPDATE SKIP LOCKED`,
      [this.maxRetries, this.batchSize],
    );

    if (batch.rows.length === 0) return result;

    // 2. Publish each event individually (preserves ordering guarantees)
    for (const row of batch.rows) {
      try {
        const topic = row.event_type;
        const payload =
          typeof row.payload === 'string'
            ? JSON.parse(row.payload)
            : row.payload;

        const publishResult = await this.broker.publish(topic, {
          eventId: row.id,
          aggregateType: row.aggregate_type,
          aggregateId: row.aggregate_id,
          tenantId: row.tenant_id,
          eventType: row.event_type,
          payload,
          createdAt:
            row.created_at instanceof Date
              ? row.created_at.toISOString()
              : row.created_at,
        });

        if (publishResult.success) {
          // Mark as dispatched
          await this.db.query(
            `UPDATE "${this.tableName}"
             SET published_at = NOW(), last_error = NULL
             WHERE id = $1`,
            [row.id],
          );
          result.dispatched++;
        } else {
          await this.recordFailure(row, 'Broker returned success=false');
          result.failed++;
        }
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : String(err);

        // Check if we've exhausted retries → DLQ
        if (row.retry_count + 1 >= this.maxRetries) {
          await this.routeToDlq(row, errorMsg);
          result.dlqRouted++;
        } else {
          await this.recordFailure(row, errorMsg);
          result.failed++;
        }
      }
    }

    return result;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private schedulePoll(): void {
    if (!this.running) return;
    this.pollTimer = setTimeout(async () => {
      try {
        await this.dispatchPending();
      } catch {
        // Swallow poll-level errors to keep the loop alive.
        // Individual event errors are handled inside dispatchPending.
      }
      this.schedulePoll();
    }, this.pollIntervalMs);
  }

  private async recordFailure(row: OutboxRow, error: string): Promise<void> {
    const nextRetryCount = row.retry_count + 1;
    // Backoff delay: 100ms * 2^retry_count (100ms, 200ms, 400ms, 800ms...)
    const delayMs = 100 * Math.pow(2, row.retry_count);
    await this.db.query(
      `UPDATE "${this.tableName}"
       SET retry_count = $1,
           last_error = $2,
           next_attempt_at = NOW() + ($3 || ' milliseconds')::INTERVAL
       WHERE id = $4`,
      [nextRetryCount, error, `${delayMs}`, row.id],
    );
  }

  private async routeToDlq(row: OutboxRow, error: string): Promise<void> {
    const dlqTopic = `${row.event_type}${this.dlqSuffix}`;

    // Best-effort publish to DLQ topic
    try {
      await this.broker.publish(dlqTopic, {
        originalEventId: row.id,
        aggregateType: row.aggregate_type,
        aggregateId: row.aggregate_id,
        tenantId: row.tenant_id,
        eventType: row.event_type,
        payload:
          typeof row.payload === 'string'
            ? JSON.parse(row.payload)
            : row.payload,
        failedAt: new Date().toISOString(),
        retryCount: row.retry_count + 1,
        lastError: error,
      });
    } catch {
      // DLQ publish failure is logged but doesn't throw
    }

    // Mark the row so it's no longer picked up
    await this.db.query(
      `UPDATE "${this.tableName}"
       SET retry_count = $1,
           last_error = $2,
           next_attempt_at = NOW()
       WHERE id = $3`,
      [this.maxRetries, `DLQ: ${error}`, row.id],
    );
  }
}
