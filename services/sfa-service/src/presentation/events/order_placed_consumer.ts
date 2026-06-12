import { InboundEvent, IdempotentConsumer } from '@dms/pkg-events';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { MessageBrokerClient } from '@dms/pkg-events';
import { StructuredLogger } from '@dms/pkg-logger';

export class OrderPlacedConsumer {
  private logger = new StructuredLogger('OrderPlacedConsumer');
  private consumer: IdempotentConsumer;

  constructor(
    private readonly db: PostgresDatabaseClient,
    private readonly broker: MessageBrokerClient,
  ) {
    this.consumer = new IdempotentConsumer(
      this.db,
      this.broker,
      this.handleEvent.bind(this),
      {
        consumerGroup: 'sfa-order-service',
        tableName: 'processed_events',
      }
    );
  }

  start(): void {
    this.logger.info('Starting OrderPlacedConsumer subscription');
    this.consumer.subscribe('order.placed.v1');
  }

  private async handleEvent(event: InboundEvent<any>): Promise<void> {
    this.logger.info('Downstream handler successfully processed order.placed event idempotently', {
      eventId: event.eventId,
      eventType: event.eventType,
      orderId: event.payload?.orderId,
      tenantId: event.tenantId,
    });
  }
}
