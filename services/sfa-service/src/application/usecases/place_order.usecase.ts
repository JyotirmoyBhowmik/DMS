import { StructuredLogger } from '@dms/pkg-logger';
import { PlaceOrderInput } from '@dms/pkg-validation';
import { OrderEntity } from '../../domain/entities/order.entity';
import { OrderAggregate } from '../../domain/aggregates/order.aggregate';
import { CloudEventBuilder } from '@dms/pkg-events';

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

    const total = aggregate.calculateTotal();
    orderEntity.totalAmount = total;

    this.logger.info('Order aggregate validated successfully', { orderId, total });

    const event = CloudEventBuilder.build({
      source: 'sfa-service',
      type: 'order.placed.v1',
      subject: `orders/${orderId}`,
      tenantId,
      data: {
        orderId,
        outletId: orderEntity.outletId,
        distributorId: 'distributor-uuid-mock-9999',
        agentId,
        totalAmount: total,
        items: orderEntity.items,
      },
    });

    this.logger.info('Order placed event created', { eventId: event.id });

    return { orderId };
  }
}
