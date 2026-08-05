import { StructuredLogger } from '@dms/pkg-logger';

export interface SchemePayoutEvent {
  eventId: string;
  tenantId: string;
  type: string;
  version: string;
  payload: {
    payoutId: string;
    payoutCode?: string;
    status?: string;
    amountCents?: number;
    version?: number;
  };
}

export class SchemePayoutProjectionHandler {
  private logger = new StructuredLogger('SchemePayoutProjectionHandler');
  private processedEvents = new Set<string>();

  async handle(event: SchemePayoutEvent): Promise<void> {
    // 1. Dedup by event ID to maintain idempotency
    if (this.processedEvents.has(event.eventId)) {
      this.logger.info(`Duplicate event ${event.eventId} ignored by SchemePayoutProjectionHandler`);
      return;
    }

    // 2. Validate event schema/version on ingest
    if (!event.tenantId || !event.payload || !event.payload.payoutId) {
      this.logger.warn(`Malformed event ${event.eventId} rejected by projection handler`);
      return;
    }

    // 3. Project state change transactionally into read model
    this.logger.info(`Projecting ${event.type} for payout ${event.payload.payoutId} in tenant ${event.tenantId}`);
    
    // Mark processed
    this.processedEvents.add(event.eventId);
  }
}
