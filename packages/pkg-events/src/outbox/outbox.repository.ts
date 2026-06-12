export interface OutboxEventInsert {
  eventId: string;
  tenantId: string;
  type: string;
  version: string;
  payload: unknown;
}

export class OutboxRepository {
  private readonly tableName: string;

  constructor(config?: { tableName?: string }) {
    this.tableName = config?.tableName ?? 'outbox_events';
  }

  /**
   * Save a domain event into the outbox_events table within the context of an existing transaction.
   *
   * @param conn The transaction connection instance.
   * @param event The domain event envelope properties.
   * @param aggregateType The type of the aggregate, e.g. "Order".
   * @param aggregateId The identifier of the aggregate.
   */
  async save(
    conn: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
    event: OutboxEventInsert,
    aggregateType: string,
    aggregateId: string,
  ): Promise<void> {
    const sql = `
      INSERT INTO "${this.tableName}" (
        id, tenant_id, aggregate_type, aggregate_id, event_type, payload, created_at, next_attempt_at, retry_count, max_retries
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), 0, 5)
    `;
    const params = [
      event.eventId,
      event.tenantId,
      aggregateType,
      aggregateId,
      `${event.type}.${event.version}`,
      JSON.stringify(event.payload),
    ];
    await conn.query(sql, params);
  }
}
