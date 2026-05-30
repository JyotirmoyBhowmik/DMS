import { Money } from './money';

/**
 * Immutable OrderLine value object.
 * Computes lineTotal as (qty × unitPrice) − discount.
 * Validates qty > 0 and discount does not exceed gross.
 */
export class OrderLine {
  public readonly sku: string;
  public readonly qty: number;
  public readonly unitPrice: Money;
  public readonly discount: Money;
  public readonly lineTotal: Money;

  private constructor(sku: string, qty: number, unitPrice: Money, discount: Money) {
    if (qty <= 0) {
      throw new Error(`OrderLine quantity must be positive, got ${qty} for SKU ${sku}`);
    }
    const gross = unitPrice.multiply(qty);
    if (discount.greaterThan(gross)) {
      throw new Error(
        `Discount (${discount.amount}) exceeds gross amount (${gross.amount}) for SKU ${sku}`,
      );
    }
    this.sku = sku;
    this.qty = qty;
    this.unitPrice = unitPrice;
    this.discount = discount;
    this.lineTotal = gross.subtract(discount);
  }

  static create(
    sku: string,
    qty: number,
    unitPriceAmount: number,
    discountAmount = 0,
    currency = 'INR',
  ): OrderLine {
    return new OrderLine(
      sku,
      qty,
      Money.of(unitPriceAmount, currency),
      Money.of(discountAmount, currency),
    );
  }

  /** Return a new OrderLine with an updated discount. */
  withDiscount(newDiscountAmount: number): OrderLine {
    return new OrderLine(
      this.sku,
      this.qty,
      this.unitPrice,
      Money.of(newDiscountAmount, this.unitPrice.currency),
    );
  }

  /** Return a new OrderLine with an updated quantity. */
  withQty(newQty: number): OrderLine {
    return new OrderLine(this.sku, newQty, this.unitPrice, this.discount);
  }

  equals(other: OrderLine): boolean {
    return (
      this.sku === other.sku &&
      this.qty === other.qty &&
      this.unitPrice.equals(other.unitPrice) &&
      this.discount.equals(other.discount)
    );
  }

  toJSON(): {
    sku: string;
    qty: number;
    unitPrice: number;
    discount: number;
    lineTotal: number;
    currency: string;
  } {
    return {
      sku: this.sku,
      qty: this.qty,
      unitPrice: this.unitPrice.amount,
      discount: this.discount.amount,
      lineTotal: this.lineTotal.amount,
      currency: this.unitPrice.currency,
    };
  }
}
