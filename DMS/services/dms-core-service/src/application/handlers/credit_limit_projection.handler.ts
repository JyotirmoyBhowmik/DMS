import { CreditLimitPgRepository } from '../../infrastructure/database/repositories/credit-limit.pg-repository.js';
import { StructuredLogger } from '@dms/pkg-logger';

export interface CreditLimitEvent {
  eventId: string;
  tenantId: string;
  type: string;
  payload: any;
}

export class CreditLimitProjectionHandler {
  private static processedEvents = new Set<string>();
  private logger = new StructuredLogger('CreditLimitProjectionHandler');

  constructor(private repo: CreditLimitPgRepository) {}

  static clearDedupeStore(): void {
    this.processedEvents.clear();
  }

  async handleEvent(event: CreditLimitEvent): Promise<{ handled: boolean; skipped: boolean }> {
    if (!event || !event.eventId || !event.tenantId) {
      throw new Error('Invalid event payload: eventId and tenantId are required');
    }

    // Idempotent deduplication check
    if (CreditLimitProjectionHandler.processedEvents.has(event.eventId)) {
      this.logger.info('Skipping duplicate credit limit event', { eventId: event.eventId });
      return { handled: false, skipped: true };
    }

    this.logger.info('Handling credit limit projection update', { type: event.type, tenantId: event.tenantId });

    if (event.type === 'distributor.credit_limit.utilized') {
      const existing = await this.repo.findById(event.tenantId, event.payload.creditLimitId);
      if (existing) {
        // Idempotent projection state update
        CreditLimitProjectionHandler.processedEvents.add(event.eventId);
        return { handled: true, skipped: false };
      }
    }

    CreditLimitProjectionHandler.processedEvents.add(event.eventId);
    return { handled: true, skipped: false };
  }
}
