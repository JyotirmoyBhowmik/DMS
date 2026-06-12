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
        consumerGroup: 'schemes-service-consumer',
        tableName: 'schemes_processed_events',
      }
    );
  }

  start(): void {
    this.logger.info('Starting OrderPlacedConsumer subscription in schemes-service');
    this.consumer.subscribe('order.placed.v1');
  }

  private async handleEvent(event: InboundEvent<any>): Promise<void> {
    this.logger.info('Schemes service consumer processed order.placed event idempotently', {
      eventId: event.eventId,
      eventType: event.eventType,
      orderId: event.payload?.orderId,
      tenantId: event.tenantId,
    });
  }
}
