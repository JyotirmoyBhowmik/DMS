import { StructuredLogger } from '@dms/pkg-logger';

export interface EventEnvelope {
  id: string;
  name: string;
  tenantId: string;
  occurredAt: string;
  payload: Record<string, any>;
}

export class NotificationTemplateEventConsumer {
  private logger = new StructuredLogger('NotificationTemplateEventConsumer');
  private processedEventIds = new Set<string>();
  private dlqMessages: EventEnvelope[] = [];

  async consume(event: EventEnvelope): Promise<{ success: boolean; isDuplicate?: boolean; routedToDlq?: boolean }> {
    if (!event || !event.id || !event.name || !event.tenantId) {
      this.logger.error('POISON_EVENT: Invalid event schema or missing envelope headers', { event });
      this.dlqMessages.push(event);
      return { success: false, routedToDlq: true };
    }

    if (this.processedEventIds.has(event.id)) {
      this.logger.warn(`Duplicate event ID '${event.id}' skipped for tenant '${event.tenantId}'`);
      return { success: true, isDuplicate: true };
    }

    this.logger.info(`Processing event [${event.name}] id=${event.id} for tenant=${event.tenantId}`);

    this.processedEventIds.add(event.id);
    return { success: true };
  }

  getDlqMessages(): EventEnvelope[] {
    return [...this.dlqMessages];
  }

  clearState(): void {
    this.processedEventIds.clear();
    this.dlqMessages = [];
  }
}
