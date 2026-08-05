import { InboundEvent, IdempotentConsumer } from '@dms/pkg-events';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { MessageBrokerClient } from '@dms/pkg-events';
import { StructuredLogger } from '@dms/pkg-logger';
import { CreditLimitPgRepository } from '../../infrastructure/database/repositories/credit-limit.pg-repository.js';
import { TransactionalDbClient } from '../../infrastructure/database/transactional-client.js';

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
        consumerGroup: 'dms-core-service-consumer',
        tableName: 'dms_processed_events',
      }
    );
  }

  start(): void {
    this.logger.info('Starting OrderPlacedConsumer subscription in dms-core-service');
    this.consumer.subscribe('order.placed.v1');
  }

  private async handleEvent(event: InboundEvent<any>): Promise<void> {
    this.logger.info('DMS core service consumer processed order.placed event idempotently', {
      eventId: event.eventId,
      eventType: event.eventType,
      orderId: event.payload?.orderId,
      distributorId: event.payload?.distributorId,
      amount: event.payload?.amount,
      tenantId: event.tenantId,
    });

    const distributorId = event.payload?.distributorId;
    const amount = event.payload?.amount;
    const tenantId = event.tenantId;

    if (!tenantId || !distributorId || !amount) {
      this.logger.warn('Event missing tenantId, distributorId, or amount. Skipping credit utilization.', { eventId: event.eventId });
      return;
    }

    const targetTenantId = tenantId as string;
    const targetDistributorId = distributorId as string;

    await this.db.transaction(async (conn) => {
      const txDb = new TransactionalDbClient(conn);
      const clRepo = new CreditLimitPgRepository(txDb);

      const cl = await clRepo.findByDistributor(targetTenantId, targetDistributorId);
      if (!cl) {
        this.logger.warn('No credit limit record found for distributor. Skipping utilization.', { distributorId, tenantId });
        return;
      }

      this.logger.info('Utilizing credit limit for order', { distributorId, amount, currentUtilized: cl.utilizedAmount });
      cl.utilize(amount);
      await clRepo.save(cl);
      this.logger.info('Credit limit utilized successfully', { distributorId, newUtilized: cl.utilizedAmount });
    }, tenantId);
  }
}
