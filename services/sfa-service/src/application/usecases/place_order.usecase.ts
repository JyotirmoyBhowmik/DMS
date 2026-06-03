import { StructuredLogger, getCorrelation } from '@dms/pkg-logger';
import { PlaceOrderInput } from '@dms/pkg-validation';
import { OrderEntity } from '../../domain/entities/order.entity';
import { OrderAggregate } from '../../domain/aggregates/order.aggregate';
import { makeEnvelope } from '@dms/pkg-events';

export class PlaceOrderUseCase {
  private logger = new StructuredLogger('PlaceOrderUseCase');

  async execute(tenantId: string, agentId: string, input: PlaceOrderInput): Promise<{ orderId: string }> {
    this.logger.info('Processing order placement request', { outletId: input.outletId });

    const orderId = 'order-uuid-mock-5678';
    const orderEntity = new OrderEntity({
      id: orderId,
      tenantId,
      outletId: input.outletId,
      items: input.items,
      notes: input.notes,
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
        distributorId: 'distributor-uuid-mock-9999',
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

    this.logger.info('Order placed event created', { eventId: event.eventId });

    return { orderId };
  }
}
