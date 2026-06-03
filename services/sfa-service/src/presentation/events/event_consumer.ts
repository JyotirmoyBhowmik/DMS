import { EventEnvelope } from '@dms/pkg-events';
import { StructuredLogger } from '@dms/pkg-logger';

export class EventConsumer {
  private logger = new StructuredLogger('EventConsumer');
  
  // Shared static memory store representing the sfa_processed_events table
  private static processedEventsStore = new Set<string>();

  static clearStore() {
    this.processedEventsStore.clear();
  }

  static getProcessedEventIds(): string[] {
    return Array.from(this.processedEventsStore);
  }

  /**
   * Consume an event envelope idempotently.
   * Checks if eventId exists in the deduplication store. If so, skips.
   * Otherwise, executes callback and records the eventId.
   */
  async consume(envelope: EventEnvelope<any>, handleFn: (event: EventEnvelope<any>) => Promise<void>): Promise<{ status: 'processed' | 'skipped' }> {
    const eventId = envelope.eventId;
    const tenantId = envelope.tenantId;
    const eventType = envelope.eventType;

    this.logger.info('Inbound event received for ingestion', { eventId, eventType, tenantId });

    if (EventConsumer.processedEventsStore.has(eventId)) {
      this.logger.warn('Event already processed. Skipping to prevent duplicates (Idempotent Consumer Pattern)', { eventId, eventType });
      return { status: 'skipped' };
    }

    try {
      await handleFn(envelope);
      
      // Persist eventId in deduplication store (represents writing to processed_events table inside transaction)
      EventConsumer.processedEventsStore.add(eventId);
      
      this.logger.info('Event processed successfully and recorded in idempotency store', { eventId, eventType });
      return { status: 'processed' };
    } catch (err: any) {
      this.logger.error('Failed to process inbound event', { eventId, eventType, error: err.message });
      throw err;
    }
  }
}
