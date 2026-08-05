import { Order } from '../entities/order.js';
import { Money } from '../value-objects/money.js';

export interface SchemeSlab {
  minAmount: number;
  discountPercentage: number;
}

export class SchemePolicy {
  // Define slab thresholds
  private static slabs: SchemeSlab[] = [
    { minAmount: 100000, discountPercentage: 10 }, // Slab 3: 10%
    { minAmount: 50000, discountPercentage: 5 },   // Slab 2: 5%
    { minAmount: 10000, discountPercentage: 2 },   // Slab 1: 2%
  ];

  // Extra stackable volume discount (if qty of any SKU >= 50)
  private static VOLUME_THRESHOLD = 50;
  private static VOLUME_DISCOUNT_PCT = 3;

  static evaluate(order: Order): { bestSlabDiscount: number; volumeDiscount: number; totalDiscountPct: number } {
    const grossAmount = order.grossTotal.amount;

    // 1. Evaluate slab discount (highest matching slab)
    let bestSlabDiscount = 0;
    const sortedSlabs = [...this.slabs].sort((a, b) => b.minAmount - a.minAmount);
    
    for (const slab of sortedSlabs) {
      if (grossAmount >= slab.minAmount) {
        bestSlabDiscount = slab.discountPercentage;
        break;
      }
    }

    // 2. Evaluate stackable volume discount
    let volumeDiscount = 0;
    for (const line of order.lines) {
      if (line.qty >= this.VOLUME_THRESHOLD) {
        volumeDiscount = this.VOLUME_DISCOUNT_PCT;
        break;
      }
    }

    const totalDiscountPct = bestSlabDiscount + volumeDiscount;

    return {
      bestSlabDiscount,
      volumeDiscount,
      totalDiscountPct,
    };
  }

  static applyBestDiscount(order: Order): Money {
    const { totalDiscountPct } = this.evaluate(order);
    if (totalDiscountPct === 0) {
      return Money.zero(order.grossTotal.currency);
    }

    // Discount = Gross * totalDiscountPct / 100
    const discountAmount = Math.round(order.grossTotal.amount * (totalDiscountPct / 100));
    return Money.of(discountAmount, order.grossTotal.currency);
  }
}
