import { OrderEntity } from '../../../domain/entities/order.entity';
import { StructuredLogger } from '@dms/pkg-logger';

export class OrderRepository {
  private logger = new StructuredLogger('OrderRepository');
  private dbStore: Map<string, OrderEntity> = new Map();

  async save(order: OrderEntity): Promise<OrderEntity> {
    this.logger.info('Saving order to repository store', { orderId: order.id, tenantId: order.tenantId });
    this.dbStore.set(order.id, order);
    return order;
  }

  async findById(orderId: string, tenantId: string): Promise<OrderEntity | null> {
    this.logger.info('Querying order by identifier', { orderId, tenantId });
    const match = this.dbStore.get(orderId);
    if (match && match.tenantId === tenantId) {
      return match;
    }
    return null;
  }
}
