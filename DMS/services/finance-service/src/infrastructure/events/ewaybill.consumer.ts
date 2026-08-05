import { StructuredLogger } from '@dms/pkg-logger';

export interface DomainEventEnvelope<T = any> {
  id: string;
  name: string;
  tenantId: string;
  occurredAt: string;
  payload: T;
  correlationId?: string;
}

export class EWayBillEventConsumer {
  private logger = new StructuredLogger('EWayBillEventConsumer');
  private processedEventIds = new Set<string>();
  private dlq: DomainEventEnvelope[] = [];

  async consume(event: DomainEventEnvelope): Promise<{ success: boolean; reason?: string }> {
    if (!event || !event.id || !event.tenantId || !event.name) {
      this.logger.error('POISON_EVENT: Invalid event schema or missing envelope headers', { event });
      this.dlq.push(event);
      return { success: false, reason: 'POISON_EVENT' };
    }

    if (this.processedEventIds.has(event.id)) {
      this.logger.warn(`Duplicate event ID '${event.id}' skipped for tenant '${event.tenantId}'`);
      return { success: true, reason: 'DUPLICATE_SKIPPED' };
    }

    this.logger.info(`Processing event [${event.name}] id=${event.id} for tenant=${event.tenantId}`);

    try {
      this.processedEventIds.add(event.id);
      return { success: true };
    } catch (err: any) {
      this.logger.error(`Error consuming event '${event.id}': ${err.message}`);
      this.dlq.push(event);
      return { success: false, reason: err.message };
    }
  }

  getDlqMessages(): DomainEventEnvelope[] {
    return [...this.dlq];
  }

  clearState(): void {
    this.processedEventIds.clear();
    this.dlq = [];
  }
}
