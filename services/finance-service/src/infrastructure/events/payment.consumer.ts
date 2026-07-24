import { StructuredLogger } from '@dms/pkg-logger';

export interface DomainEventEnvelope<T = any> {
  id: string;
  name: string;
  occurredAt: string;
  tenantId: string;
  payload: T;
}

export class PaymentEventConsumer {
  private logger = new StructuredLogger('PaymentEventConsumer');
  private processedEvents = new Set<string>();
  private deadLetterQueue: Array<{ event: DomainEventEnvelope; reason: string; errorAt: string }> = [];

  public clearDeduplicationStore(): void {
    this.processedEvents.clear();
    this.deadLetterQueue = [];
  }

  public getDLQ() {
    return [...this.deadLetterQueue];
  }

  public isProcessed(eventId: string): boolean {
    return this.processedEvents.has(eventId);
  }

  async handleEvent(event: DomainEventEnvelope): Promise<{ success: boolean; duplicate?: boolean }> {
    if (!event || !event.id || !event.tenantId || !event.name || !event.payload) {
      const reason = 'POISON_EVENT: Invalid event schema or missing envelope headers';
      this.logger.error(reason, { event });
      this.deadLetterQueue.push({ event, reason, errorAt: new Date().toISOString() });
      return { success: false };
    }

    if (this.processedEvents.has(event.id)) {
      this.logger.warn(`Duplicate event ID '${event.id}' skipped for tenant '${event.tenantId}'`);
      return { success: true, duplicate: true };
    }

    try {
      this.logger.info(`Processing event [${event.name}] id=${event.id} for tenant=${event.tenantId}`);
      
      // Perform projection write or ledger update logic based on event name
      switch (event.name) {
        case 'finance.payment.completed':
        case 'finance.payment.failed':
        case 'finance.payment.refunded':
          // Valid domain events
          break;
        default:
          this.logger.warn(`Unhandled event type '${event.name}'`);
      }

      this.processedEvents.add(event.id);
      return { success: true };
    } catch (err: any) {
      const reason = `PROCESSING_ERROR: ${err.message}`;
      this.logger.error(reason, { eventId: event.id });
      this.deadLetterQueue.push({ event, reason, errorAt: new Date().toISOString() });
      return { success: false };
    }
  }
}
