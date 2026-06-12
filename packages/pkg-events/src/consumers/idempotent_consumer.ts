import { MessageBrokerClient } from '../broker/rabbitmq.js';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Minimal database client interface for the idempotent consumer.
 * Mirrors the PostgresDatabaseClient shape without a hard dependency.
 */
export interface IConsumerDatabaseClient {
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

/**
 * The shape of an inbound event as received from the message broker.
 */
export interface InboundEvent<T = unknown> {
  /** Unique event ID used for deduplication */
  eventId: string;
  /** CloudEvents-style event type, e.g. "order.placed.v1" */
  eventType: string;
  /** Tenant discriminator */
  tenantId?: string;
  /** Domain payload */
  payload: T;
  /** Number of times delivery has been attempted (set by broker) */
  deliveryAttempt?: number;
}

/**
 * User-supplied handler that processes a single event.
 */
export type EventHandler<T = unknown> = (event: InboundEvent<T>) => Promise<void>;

export interface IdempotentConsumerConfig {
  /** Consumer group identifier (e.g. "order-service") */
  consumerGroup: string;
  /** Table name for deduplication tracking. Default: "processed_events" */
  tableName?: string;
  /** Maximum delivery attempts before routing to DLQ. Default: 5 */
  maxRetries?: number;
  /** DLQ topic suffix. Default: ".dlq" */
  dlqSuffix?: string;
  /** Exchange name to subscribe to. Default: "dms.events" */
  exchangeName?: string;
}

export interface ProcessingResult {
  eventId: string;
  status: 'processed' | 'duplicate' | 'dlq';
  error?: string;
}

// ─── Idempotent Consumer ──────────────────────────────────────────────────────

export class IdempotentConsumer<T = unknown> {
  private readonly db: IConsumerDatabaseClient;
  private readonly broker: MessageBrokerClient;
  private readonly handler: EventHandler<T>;
  private readonly consumerGroup: string;
  private readonly tableName: string;
  private readonly maxRetries: number;
  private readonly dlqSuffix: string;
  private readonly exchangeName: string;

  constructor(
    db: IConsumerDatabaseClient,
    broker: MessageBrokerClient,
    handler: EventHandler<T>,
    config: IdempotentConsumerConfig,
  ) {
    this.db = db;
    this.broker = broker;
    this.handler = handler;
    this.consumerGroup = config.consumerGroup;
    this.tableName = config.tableName ?? 'processed_events';
    this.maxRetries = config.maxRetries ?? 5;
    this.dlqSuffix = config.dlqSuffix ?? '.dlq';
    this.exchangeName = config.exchangeName ?? 'dms.events';
  }

  /**
   * Subscribe to a topic.  Every message is routed through the idempotency
   * check before being handed to the wrapped handler.
   */
  subscribe(topic: string): void {
    const queueName = `${this.consumerGroup}.${topic}`;
    const dlqName = `${queueName}.dlq`;

    this.broker.subscribe(
      topic,
      async (raw: unknown) => {
        const event = raw as InboundEvent<T>;
        await this.handle(event);
      },
      {
        queueName,
        exchangeName: this.exchangeName,
        dlqName,
        maxRetries: this.maxRetries,
      },
    );
  }

  /**
   * Process a single event with idempotency + DLQ semantics.
   * Can also be called directly (outside of a subscription) for testing.
   */
  async handle(event: InboundEvent<T>): Promise<ProcessingResult> {
    // 1. Check if already processed (deduplication)
    const existing = await this.db.query<{ event_id: string }>(
      `SELECT event_id FROM "${this.tableName}"
       WHERE event_id = $1 AND consumer_group = $2
       LIMIT 1`,
      [event.eventId, this.consumerGroup],
    );

    if (existing.rows.length > 0) {
      return { eventId: event.eventId, status: 'duplicate' };
    }

    // 2. Check retry budget
    const attempt = event.deliveryAttempt ?? 1;
    if (attempt > this.maxRetries) {
      await this.routeToDlq(event, `Exceeded max retries (${this.maxRetries})`);
      return {
        eventId: event.eventId,
        status: 'dlq',
        error: `Exceeded max retries (${this.maxRetries})`,
      };
    }

    // 3. Process within a transaction: handler + deduplication record
    try {
      await this.db.transaction(async (conn) => {
        // Run the user-supplied handler
        await this.handler(event);

        // Record the event as processed (inside the same transaction)
        await conn.query(
          `INSERT INTO "${this.tableName}" (event_id, consumer_group, processed_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (event_id, consumer_group) DO NOTHING`,
          [event.eventId, this.consumerGroup],
        );
      }, event.tenantId);

      return { eventId: event.eventId, status: 'processed' };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);

      // If this was the last allowed attempt, route to DLQ
      if (attempt >= this.maxRetries) {
        await this.routeToDlq(event, errorMsg);
        return { eventId: event.eventId, status: 'dlq', error: errorMsg };
      }

      // Otherwise re-throw so the broker can re-deliver
      throw err;
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async routeToDlq(
    event: InboundEvent<T>,
    error: string,
  ): Promise<void> {
    const dlqExchange = `${this.exchangeName}.dlx`;
    const routingKey = event.eventType;

    try {
      await this.broker.publish(routingKey, {
        eventId: event.eventId,
        eventType: event.eventType,
        tenantId: event.tenantId,
        payload: event.payload,
        consumerGroup: this.consumerGroup,
        failedAt: new Date().toISOString(),
        deliveryAttempt: event.deliveryAttempt ?? 1,
        lastError: error,
      }, { exchangeName: dlqExchange });
    } catch {
      // Swallow DLQ publish failures
    }
  }
}
