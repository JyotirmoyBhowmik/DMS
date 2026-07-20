import { InboundEvent, IdempotentConsumer } from '@dms/pkg-events';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { MessageBrokerClient } from '@dms/pkg-events';
import { StructuredLogger } from '@dms/pkg-logger';
import { SalesTargetPgRepository } from '../../../infrastructure/database/repositories/sales-target.pg-repository.js';
import { Money } from '../../../domain/value-objects/money.js';

export class OrderPlacedSalesTargetConsumer {
  private logger = new StructuredLogger('OrderPlacedSalesTargetConsumer');
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
        consumerGroup: 'sfa-sales-target-service',
        tableName: 'processed_events',
      }
    );
  }

  start(): void {
    this.logger.info('Starting OrderPlacedSalesTargetConsumer subscription');
    this.consumer.subscribe('order.placed.v1');
  }

  private async handleEvent(event: InboundEvent<any>): Promise<void> {
    const { agentId, totalAmount, currency, timestamp } = event.payload || {};
    const tenantId = event.tenantId;

    if (!agentId || !totalAmount || !tenantId) {
      this.logger.warn('OrderPlacedSalesTargetConsumer skipped: missing vital properties', { eventId: event.eventId });
      return;
    }

    this.logger.info('OrderPlacedSalesTargetConsumer processing order.placed', {
      eventId: event.eventId,
      agentId,
      totalAmount,
      tenantId,
    });

    const date = timestamp ? new Date(timestamp) : new Date();
    const periodMonth = date.getMonth() + 1;
    const periodYear = date.getFullYear();

    const repo = new SalesTargetPgRepository(this.db);

    try {
      await this.db.transaction(async (conn) => {
        const txRepo = new SalesTargetPgRepository(conn);
        const targets = await txRepo.findByAgentAndPeriod(agentId, periodMonth, periodYear, tenantId);
        
        // Find active target of type 'volume' or 'value'
        const activeTarget = targets.find((t) => t.status === 'ACTIVE');
        if (!activeTarget) {
          this.logger.info('No active sales target found for agent in this period', { agentId, periodYear, periodMonth });
          return;
        }

        const addAmount = Money.fromCents(Math.round(totalAmount * 100));
        activeTarget.addAchievement(addAmount);

        await txRepo.save(activeTarget, tenantId);

        this.logger.info('SalesTarget achievement progress updated successfully', {
          targetId: activeTarget.id,
          newAchievedAmount: activeTarget.achievedAmount.amount,
          newProgress: activeTarget.progressPercentage,
        });
      }, tenantId);
    } catch (err: any) {
      this.logger.error('Failed to update sales target achievement on order.placed event', {
        eventId: event.eventId,
        error: err.message,
      });
      throw err;
    }
  }
}
