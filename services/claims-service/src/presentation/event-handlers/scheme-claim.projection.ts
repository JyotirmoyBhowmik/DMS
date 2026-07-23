import { StructuredLogger } from '@dms/pkg-logger';

export interface SchemeClaimEvent {
  eventId: string;
  tenantId: string;
  type: string;
  version: string;
  payload: {
    schemeClaimId: string;
    claimCode?: string;
    status?: string;
    claimAmountCents?: number;
    approvedAmountCents?: number;
    version?: number;
  };
}

export class SchemeClaimProjectionHandler {
  private logger = new StructuredLogger('SchemeClaimProjectionHandler');
  private processedEvents = new Set<string>();

  async handle(event: SchemeClaimEvent): Promise<void> {
    if (this.processedEvents.has(event.eventId)) {
      this.logger.info(`Duplicate event ${event.eventId} ignored by SchemeClaimProjectionHandler`);
      return;
    }

    if (!event.tenantId || !event.payload || !event.payload.schemeClaimId) {
      this.logger.warn(`Malformed event ${event.eventId} rejected by projection handler`);
      return;
    }

    this.logger.info(`Projecting ${event.type} for scheme claim ${event.payload.schemeClaimId} in tenant ${event.tenantId}`);
    this.processedEvents.add(event.eventId);
  }
}
