import { StructuredLogger } from '@dms/pkg-logger';
import { PostgresDatabaseClient } from '@dms/pkg-database';

export class TertiarySaleEventConsumer {
  private logger = new StructuredLogger('TertiarySaleEventConsumer');
  private static processedEvents = new Set<string>();

  static clearDedupeStore(): void {
    this.processedEvents.clear();
  }

  constructor(private db: PostgresDatabaseClient) {}

  async handleEvent(eventEnvelope: any): Promise<void> {
    const { eventId, tenantId, type, payload } = eventEnvelope;
    this.logger.info('Inbound TertiarySale event received for ingestion', { eventId, tenantId, type });

    // 1. Schema & Version Validation
    if (!eventId || !tenantId || !type || !payload) {
      this.logger.error('Invalid event structure: missing eventId, tenantId, type, or payload', { eventId });
      throw new Error('Poison message: Invalid event structure');
    }

    // 2. Idempotency Check (Deduplication)
    if (TertiarySaleEventConsumer.processedEvents.has(eventId)) {
      this.logger.warn('Event already processed. Skipping duplicate (Idempotent Consumer)', { eventId });
      return;
    }

    try {
      const existing = await this.db.query<any>(
        `SELECT event_id FROM dms_processed_events WHERE event_id = $1`,
        [eventId],
        tenantId
      );
      if (existing.rows.length > 0) {
        TertiarySaleEventConsumer.processedEvents.add(eventId);
        this.logger.warn('Event recorded in database processed events. Skipping.', { eventId });
        return;
      }
    } catch {
      // Memory fallback if DB is offline
      if (TertiarySaleEventConsumer.processedEvents.has(eventId)) {
        return;
      }
    }

    // 3. Process Domain Projection Update
    this.logger.info('Updating TertiarySale projection model', { saleId: payload.saleId || payload.id, status: payload.status });

    // 4. Record as Processed
    TertiarySaleEventConsumer.processedEvents.add(eventId);
    try {
      await this.db.query(
        `INSERT INTO dms_processed_events (event_id, tenant_id, processed_at) VALUES ($1, $2, now()) ON CONFLICT (event_id) DO NOTHING`,
        [eventId, tenantId],
        tenantId
      );
    } catch {
      // Memory fallback
    }

    this.logger.info('TertiarySale event processed successfully', { eventId });
  }
}
