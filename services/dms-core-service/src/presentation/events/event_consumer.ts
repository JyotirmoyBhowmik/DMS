import { EventEnvelope } from '@dms/pkg-events';
import { StructuredLogger } from '@dms/pkg-logger';
import { PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { loadConfigSync } from '@dms/pkg-config';

const config = loadConfigSync();

export class EventConsumer {
  private logger = new StructuredLogger('EventConsumer');
  private db?: PostgresDatabaseClient;

  // Shared static memory store representing the dms_processed_events table
  private static processedEventsStore = new Set<string>();

  static clearStore() {
    this.processedEventsStore.clear();
  }

  static getProcessedEventIds(): string[] {
    return Array.from(this.processedEventsStore);
  }

  constructor(db?: PostgresDatabaseClient) {
    if (db) {
      this.db = db;
    } else {
      try {
        this.db = new PostgresDatabaseClient(config.db, new PgDriver());
      } catch {
        // tolerate missing DB in simple unit tests
      }
    }
  }

  /**
   * Consume an event envelope idempotently.
   * Checks if eventId exists in the deduplication store. If so, skips.
   * Otherwise, executes callback and records the eventId.
   */
  async consume(envelope: EventEnvelope<any>, handleFn: (event: EventEnvelope<any>) => Promise<void>): Promise<{ status: 'processed' | 'skipped' }> {
    const eventId = envelope.eventId;
    const tenantId = envelope.tenantId;
    const eventType = envelope.type;
    const sourceService = envelope.producer || 'unknown-service';

    this.logger.info('Inbound event received for ingestion', { eventId, eventType, tenantId });

    // 1. Try DB-backed check first
    if (this.db) {
      try {
        const sqlSelect = `SELECT 1 FROM dms_processed_events WHERE tenant_id = $1 AND event_id = $2`;
        const checkResult = await this.db.query(sqlSelect, [tenantId, eventId], tenantId);
        if (checkResult.rows.length > 0) {
          this.logger.warn('Event already processed in DB. Skipping to prevent duplicates (Idempotent Consumer Pattern)', { eventId, eventType });
          return { status: 'skipped' };
        }
      } catch (err: any) {
        this.logger.warn('DB check for processed events failed, using in-memory fallback', { error: err.message });
        if (EventConsumer.processedEventsStore.has(eventId)) {
          this.logger.warn('Event already processed. Skipping to prevent duplicates (Idempotent Consumer Pattern)', { eventId, eventType });
          return { status: 'skipped' };
        }
      }
    } else {
      if (EventConsumer.processedEventsStore.has(eventId)) {
        this.logger.warn('Event already processed. Skipping to prevent duplicates (Idempotent Consumer Pattern)', { eventId, eventType });
        return { status: 'skipped' };
      }
    }

    try {
      await handleFn(envelope);

      // 2. Mark event as processed
      if (this.db) {
        try {
          const sqlInsert = `INSERT INTO dms_processed_events (event_id, tenant_id, event_type, source_service) VALUES ($1, $2, $3, $4)`;
          await this.db.query(sqlInsert, [eventId, tenantId, eventType, sourceService], tenantId);
        } catch (err: any) {
          this.logger.warn('Failed to insert into dms_processed_events, using in-memory set as fallback', { error: err.message });
          EventConsumer.processedEventsStore.add(eventId);
        }
      } else {
        EventConsumer.processedEventsStore.add(eventId);
      }

      this.logger.info('Event processed successfully and recorded in idempotency store', { eventId, eventType });
      return { status: 'processed' };
    } catch (err: any) {
      this.logger.error('Failed to process inbound event', { eventId, eventType, error: err.message });
      throw err;
    }
  }
}
