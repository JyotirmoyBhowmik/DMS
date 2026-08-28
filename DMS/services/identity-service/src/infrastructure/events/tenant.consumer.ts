import { StructuredLogger } from '@dms/pkg-logger';

interface TenantEvent {
  id: string;
  name: string;
  tenantId: string;
  occurredAt: string;
  payload?: Record<string, any>;
}

export class TenantEventConsumer {
  private logger = new StructuredLogger('TenantEventConsumer');
  private processedEventIds = new Set<string>();
  private dlq: TenantEvent[] = [];

  async handleEvent(event: TenantEvent): Promise<void> {
    // Validate event schema
    if (!event.id || !event.name || !event.tenantId || !event.occurredAt) {
      this.logger.error('POISON_EVENT: Invalid event schema or missing envelope headers', {
        event,
      });
      this.dlq.push(event);
      return;
    }

    // Deduplication check
    if (this.processedEventIds.has(event.id)) {
      this.logger.warn(`Duplicate event ID '${event.id}' skipped for tenant '${event.tenantId}'`);
      return;
    }

    this.processedEventIds.add(event.id);

    this.logger.info(
      `Processing event [${event.name}] id=${event.id} for tenant=${event.tenantId}`,
    );
  }

  getDlq(): TenantEvent[] {
    return [...this.dlq];
  }
}
