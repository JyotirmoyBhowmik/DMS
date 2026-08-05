import { StructuredLogger } from '@dms/pkg-logger';

export interface DomainEvent<T = any> {
  eventId: string;
  eventType: string;
  aggregateId: string;
  tenantId: string;
  timestamp: string;
  data: T;
}

export class RecommendationEventConsumer {
  private logger = new StructuredLogger('RecommendationEventConsumer');
  private processedEvents: Set<string> = new Set<string>();
  private dlq: DomainEvent[] = [];

  public async handleEvent(event: DomainEvent): Promise<boolean> {
    if (!event || !event.eventId || !event.eventType) {
      this.logger.error('Invalid event structure', { event });
      if (event) this.dlq.push(event);
      return false;
    }

    if (this.processedEvents.has(event.eventId)) {
      this.logger.info(`Duplicate event ignored: ${event.eventId}`);
      return true;
    }

    try {
      if (event.eventType.startsWith('recommendation.')) {
        this.logger.info(`Processing recommendation event: ${event.eventType}`, { eventId: event.eventId });
        this.processedEvents.add(event.eventId);
        return true;
      }
      this.logger.warn(`Unhandled event type: ${event.eventType}`);
      return false;
    } catch (err: any) {
      this.logger.error(`Error consuming recommendation event ${event.eventId}: ${err.message}`);
      this.dlq.push(event);
      return false;
    }
  }

  public getDlq(): DomainEvent[] {
    return [...this.dlq];
  }

  public clearDlq(): void {
    this.dlq = [];
  }
}
