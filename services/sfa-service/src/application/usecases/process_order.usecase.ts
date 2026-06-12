import { StructuredLogger, getCorrelation } from '@dms/pkg-logger';
import { OrderEntity } from '../../domain/entities/order.entity.js';
import { OrderAggregate } from '../../domain/aggregates/order.aggregate.js';
import { SchemePolicy } from '../../domain/policies/scheme_policy.js';
import { Order } from '../../domain/entities/order.js';
import { OrderLine } from '../../domain/value-objects/order-line.js';
import { Money } from '../../domain/value-objects/money.js';
import { makeEnvelope, OutboxRepository } from '@dms/pkg-events';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { IOrderRepository } from '../../domain/repositories/order.repository.js';
import { OrderPgRepository } from '../../infrastructure/database/repositories/order.pg-repository.js';
import { TransactionalDbClient } from '../../infrastructure/database/transactional-client.js';

export interface ProcessOrderResult {
  orderId: string;
  status: string;
  netTotal: number;
  taxAmount: number;
  discountAmount: number;
  event: any;
}

export class ProcessOrderUseCase {
  private logger = new StructuredLogger('ProcessOrderUseCase');
  private outboxRepo = new OutboxRepository({ tableName: 'sfa_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly orderRepo?: IOrderRepository,
  ) {}

  async execute(
    orderEntity: OrderEntity,
    creditLimitAmount = 1000000 // $10,000 credit limit (in paise/cents)
  ): Promise<ProcessOrderResult> {
    this.logger.info('Processing placed order for discounts and tax adjustments', { orderId: orderEntity.id });

    const aggregate = new OrderAggregate(orderEntity);
    aggregate.validateInvariants();
    aggregate.place();

    // 1. Reconstitute order for Scheme evaluation
    const orderDomain = Order.create({
      id: orderEntity.id,
      tenantId: orderEntity.tenantId,
      agentId: orderEntity.agentId || 'agent-1',
      outletId: orderEntity.outletId,
      distributorId: orderEntity.distributorId || 'dist-1',
      creditLimit: Money.of(creditLimitAmount, 'INR'),
      outstandingBalance: Money.zero(),
    });

    for (const item of orderEntity.items) {
      orderDomain.addLine(
        OrderLine.create(item.skuId, item.quantity, item.price)
      );
    }

    // 2. Evaluate stackable schemes
    const discountMoney = SchemePolicy.applyBestDiscount(orderDomain);
    const discountVal = discountMoney.amount;

    // 3. Recompute totals with 18% standard GST tax rate and the calculated scheme discounts
    aggregate.recomputeTotals(18.0, discountVal);
    const finalAmount = orderEntity.totalAmount;

    // 4. Perform credit checks
    if (finalAmount > creditLimitAmount) {
      throw new Error(`Order amount ${finalAmount} exceeds credit limit ${creditLimitAmount}`);
    }

    // 5. Confirm order
    aggregate.confirm();

    // 6. Raise order.confirmed.v1 event for transaction outbox
    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'order.confirmed',
      'v1',
      {
        orderId: orderEntity.id,
        tenantId: orderEntity.tenantId,
        netTotal: finalAmount,
        discountAmount: discountVal,
        items: orderEntity.items,
        status: orderEntity.status,
      },
      {
        tenantId: orderEntity.tenantId,
        correlationId: activeCtx?.correlationId ?? 'correlation-uuid-mock',
        producer: 'sfa-service',
        partitionKey: orderEntity.id,
        causationId: activeCtx?.causationId,
      }
    );

    // If real Postgres DB client is injected, run database updates in transaction
    if (this.db) {
      await this.db.transaction(async (conn) => {
        const txDb = new TransactionalDbClient(conn);
        const txRepo = this.orderRepo || new OrderPgRepository(txDb);

        // Update existing order in Postgres (includes version check / optimistic locking)
        await txRepo.update(orderEntity, orderEntity.tenantId);

        // Save outbox event
        await this.outboxRepo.save(conn, {
          eventId: event.eventId,
          tenantId: orderEntity.tenantId,
          type: event.type,
          version: 'v1',
          payload: event.payload,
        }, 'Order', orderEntity.id);
      }, orderEntity.tenantId);
      this.logger.info('Order updated and outbox event registered in transaction');
    }

    this.logger.info('Order successfully processed and confirmed. Outbox event raised.', {
      orderId: orderEntity.id,
      netTotal: finalAmount,
      eventId: event.eventId,
    });

    return {
      orderId: orderEntity.id,
      status: orderEntity.status!,
      netTotal: finalAmount,
      taxAmount: Math.round((aggregate.calculateSubtotal() - discountVal) * 0.18),
      discountAmount: discountVal,
      event,
    };
  }
}
