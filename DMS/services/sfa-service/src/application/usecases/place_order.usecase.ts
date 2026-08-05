import { randomUUID } from 'node:crypto';
import { StructuredLogger, getCorrelation } from '@dms/pkg-logger';
import { PlaceOrderInput } from '@dms/pkg-validation';
import { OrderEntity } from '../../domain/entities/order.entity.js';
import { OrderAggregate } from '../../domain/aggregates/order.aggregate.js';
import { makeEnvelope } from '@dms/pkg-events';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { IOrderRepository } from '../../domain/repositories/order.repository.js';
import { OrderPgRepository } from '../../infrastructure/database/repositories/order.pg-repository.js';
import { TransactionalDbClient } from '../../infrastructure/database/transactional-client.js';
import { OutboxRepository } from '@dms/pkg-events';

export class PlaceOrderUseCase {
  private logger = new StructuredLogger('PlaceOrderUseCase');
  private outboxRepo = new OutboxRepository({ tableName: 'sfa_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly orderRepo?: IOrderRepository,
  ) {}

  async execute(tenantId: string, agentId: string, input: PlaceOrderInput): Promise<{ orderId: string }> {
    this.logger.info('Processing order placement request', { outletId: input.outletId });

    const orderId = (input as any).id || randomUUID();
    const orderEntity = new OrderEntity({
      id: orderId,
      tenantId,
      outletId: input.outletId,
      items: input.items,
      notes: input.notes,
      agentId,
      distributorId: '00000000-0000-0000-0000-000000009999',
      idempotencyKey: `idem-${orderId}`,
      placedAt: new Date(),
    });

    const aggregate = new OrderAggregate(orderEntity);
    aggregate.validateInvariants();

    const total = aggregate.calculateSubtotal();
    orderEntity.totalAmount = total;

    this.logger.info('Order aggregate validated successfully', { orderId, total });

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'order.placed',
      'v1',
      {
        orderId,
        outletId: orderEntity.outletId,
        distributorId: '00000000-0000-0000-0000-000000009999',
        agentId,
        totalAmount: total,
        items: orderEntity.items,
      },
      {
        tenantId,
        correlationId: activeCtx?.correlationId ?? 'correlation-uuid-mock',
        producer: 'sfa-service',
        partitionKey: orderId,
        causationId: activeCtx?.causationId,
      }
    );

    // If real Postgres DB client is injected, run in transaction
    if (this.db) {
      await this.db.transaction(async (conn) => {
        const txDb = new TransactionalDbClient(conn);
        const txRepo = this.orderRepo || new OrderPgRepository(txDb);

        // 1. Save order to Postgres
        await txRepo.save(orderEntity, tenantId);

        // 2. Save outbox event to Postgres
        await this.outboxRepo.save(conn, {
          eventId: event.eventId,
          tenantId,
          type: event.type,
          version: 'v1',
          payload: event.payload,
        }, 'Order', orderId);
      }, tenantId);
      this.logger.info('Order persisted and outbox event registered in transaction');
    }

    this.logger.info('Order placed event created', { eventId: event.eventId });

    return { orderId };
  }
}
