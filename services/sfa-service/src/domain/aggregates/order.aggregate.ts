import { OrderEntity, OrderEntityStatus } from '../entities/order.entity.js';

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

  calculateSubtotal(): number {
    return this.order.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  }

  /**
   * Recompute totals with the target tax formula:
   * NetTotal = (Subtotal - discountAmount) * (1 + taxFormulaPct / 100)
   */
  recomputeTotals(taxFormulaPct = 18.0, discountAmount = 0): void {
    this.validateInvariants();
    const subtotal = this.calculateSubtotal();
    
    if (discountAmount > subtotal) {
      throw new Error('Discount amount cannot exceed order subtotal');
    }

    const taxableAmount = subtotal - discountAmount;
    const taxAmount = Math.round(taxableAmount * (taxFormulaPct / 100));
    
    this.order.totalAmount = taxableAmount + taxAmount;
  }

  place(): void {
    this.validateInvariants();
    if (this.order.status && this.order.status !== 'draft') {
      throw new Error(`Cannot place order in ${this.order.status} status`);
    }
    this.order.status = 'placed';
  }

  confirm(): void {
    if (this.order.status !== 'placed') {
      throw new Error(`Cannot confirm order in ${this.order.status} status`);
    }
    this.order.status = 'confirmed';
  }

  cancel(): void {
    if (this.order.status === 'confirmed') {
      throw new Error('Cannot cancel a confirmed order');
    }
    this.order.status = 'cancelled';
  }
}
