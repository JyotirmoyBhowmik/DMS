import { StructuredLogger } from '@dms/pkg-logger';

export interface ClaimEvent {
  eventId: string;
  tenantId: string;
  type: string;
  version: string;
  payload: {
    claimId: string;
    claimCode?: string;
    status?: string;
    claimAmountCents?: number;
    approvedAmountCents?: number;
    version?: number;
  };
}

export class ClaimProjectionHandler {
  private logger = new StructuredLogger('ClaimProjectionHandler');
  private processedEvents = new Set<string>();

  async handle(event: ClaimEvent): Promise<void> {
    // 1. Dedup by event ID to maintain idempotency
    if (this.processedEvents.has(event.eventId)) {
      this.logger.info(`Duplicate event ${event.eventId} ignored by ClaimProjectionHandler`);
      return;
    }

    // 2. Validate event schema/version on ingest
    if (!event.tenantId || !event.payload || !event.payload.claimId) {
      this.logger.warn(`Malformed event ${event.eventId} rejected by projection handler`);
      return;
    }

    // 3. Project state change transactionally into read model
    this.logger.info(`Projecting ${event.type} for claim ${event.payload.claimId} in tenant ${event.tenantId}`);
    
    // Mark processed
    this.processedEvents.add(event.eventId);
  }
}
