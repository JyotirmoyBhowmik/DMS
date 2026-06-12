import { OrderEntity } from '../entities/order.entity.js';

export interface IOrderRepository {
  save(order: OrderEntity, tenantId: string): Promise<OrderEntity>;
  findById(id: string, tenantId: string): Promise<OrderEntity>;
  update(order: OrderEntity, tenantId: string): Promise<OrderEntity>;
}
