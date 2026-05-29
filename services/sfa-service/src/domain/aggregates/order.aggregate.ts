import { OrderEntity } from '../entities/order.entity';

export class OrderAggregate {
  private order: OrderEntity;

  constructor(order: OrderEntity) {
    this.order = order;
  }

  getOrder(): OrderEntity {
    return this.order;
  }

  validateInvariants(): void {
    if (!this.order.outletId) {
      throw new Error('Order aggregate invariant failed: outletId is required');
    }
    if (this.order.items.length === 0) {
      throw new Error('Order aggregate invariant failed: items must not be empty');
    }
    for (const item of this.order.items) {
      if (item.quantity <= 0) {
        throw new Error('Order aggregate invariant failed: item quantity must be positive');
      }
      if (item.price <= 0) {
        throw new Error('Order aggregate invariant failed: item price must be positive');
      }
    }
  }

  calculateTotal(): number {
    return this.order.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  }
}
