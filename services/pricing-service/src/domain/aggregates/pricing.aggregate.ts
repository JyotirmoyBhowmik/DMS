import { PriceListEntity } from '../entities/price-list.entity.js';
import { PriceListEntryEntity, PriceListEntryTier } from '../entities/price-list-entry.entity.js';

export interface CalculationResult {
  productId: string;
  quantity: number;
  baseUnitPrice: string; // serialized BigInt
  discountedUnitPrice: string; // serialized BigInt
  subtotal: string; // (discountedUnitPrice * quantity)
  discountAmount: string; // (baseUnitPrice - discountedUnitPrice) * quantity
  taxRate: number;
  taxAmount: string;
  totalAmount: string; // subtotal + taxAmount
}

export class PricingAggregate {
  constructor(private readonly priceList: PriceListEntity) {}

  getPriceList(): PriceListEntity {
    return this.priceList;
  }

  validateInvariants(): void {
    if (!this.priceList.name.trim()) {
      throw new Error('Price list invariant failed: name must not be empty');
    }
    if (!this.priceList.tenantId) {
      throw new Error('Price list invariant failed: tenantId is required');
    }
    if (this.priceList.effectiveTo && this.priceList.effectiveFrom > this.priceList.effectiveTo) {
      throw new Error('Price list invariant failed: effectiveFrom must be before or equal to effectiveTo');
    }

    if (this.priceList.entries) {
      for (const entry of this.priceList.entries) {
        if (!entry.productId) {
          throw new Error('Price list entry invariant failed: productId is required');
        }
        if (entry.basePrice < 0n) {
          throw new Error('Price list entry invariant failed: basePrice must be non-negative');
        }
        if (entry.mrp < 0n) {
          throw new Error('Price list entry invariant failed: mrp must be non-negative');
        }
        if (entry.mrp < entry.basePrice) {
          throw new Error('Price list entry invariant failed: mrp must be greater than or equal to basePrice');
        }

        if (entry.tiers) {
          const sortedTiers = [...entry.tiers].sort((a, b) => a.minQuantity - b.minQuantity);
          for (let i = 0; i < sortedTiers.length; i++) {
            const tier = sortedTiers[i];
            if (tier.minQuantity <= 0) {
              throw new Error('Price list entry tier invariant failed: minQuantity must be greater than 0');
            }
            if (tier.discountPercentage !== undefined) {
              if (tier.discountPercentage < 0 || tier.discountPercentage > 100) {
                throw new Error('Price list entry tier invariant failed: discountPercentage must be between 0 and 100');
              }
              if (tier.discountFlat !== undefined) {
                throw new Error('Price list entry tier invariant failed: cannot specify both discountPercentage and discountFlat');
              }
            } else if (tier.discountFlat !== undefined) {
              if (tier.discountFlat < 0n) {
                throw new Error('Price list entry tier invariant failed: discountFlat must be non-negative');
              }
            } else {
              throw new Error('Price list entry tier invariant failed: either discountPercentage or discountFlat must be specified');
            }
          }
        }
      }
    }
  }

  /**
   * Performs the pricing calculation for a specific product entry and quantity
   */
  calculatePrice(
    productId: string,
    quantity: number,
    taxRatePercentage: number,
    roundingRule = 'HALF_UP'
  ): CalculationResult {
    const entry = this.priceList.entries?.find(e => e.productId === productId);
    if (!entry) {
      throw new Error(`Product ${productId} is not mapped in price list ${this.priceList.id}`);
    }

    if (quantity <= 0) {
      throw new Error('Pricing calculation failed: quantity must be greater than 0');
    }

    const basePrice = entry.basePrice;

    // 1. Evaluate discount tiers (slabs)
    // Find the highest minQuantity tier where quantity >= minQuantity
    let matchingTier: PriceListEntryTier | undefined;
    if (entry.tiers && entry.tiers.length > 0) {
      const eligibleTiers = entry.tiers.filter(t => quantity >= t.minQuantity);
      if (eligibleTiers.length > 0) {
        matchingTier = eligibleTiers.reduce((max, t) => t.minQuantity > max.minQuantity ? t : max, eligibleTiers[0]);
      }
    }

    let discountedUnitPrice = basePrice;
    if (matchingTier) {
      if (matchingTier.discountPercentage !== undefined) {
        const discountFactor = (100 - matchingTier.discountPercentage) / 100;
        discountedUnitPrice = BigInt(Math.round(Number(basePrice) * discountFactor));
      } else if (matchingTier.discountFlat !== undefined) {
        discountedUnitPrice = basePrice - matchingTier.discountFlat;
        if (discountedUnitPrice < 0n) {
          discountedUnitPrice = 0n;
        }
      }
    }

    // 2. Subtotal and Discount
    const subtotal = discountedUnitPrice * BigInt(quantity);
    const baseTotal = basePrice * BigInt(quantity);
    const discountAmount = baseTotal - subtotal;

    // 3. Tax Calculation
    const taxAmountNum = Number(subtotal) * (taxRatePercentage / 100);
    let taxAmount = 0n;
    
    if (roundingRule === 'CEIL' || roundingRule === 'UP') {
      taxAmount = BigInt(Math.ceil(taxAmountNum));
    } else if (roundingRule === 'FLOOR' || roundingRule === 'DOWN') {
      taxAmount = BigInt(Math.floor(taxAmountNum));
    } else {
      // DEFAULT: HALF_UP standard rounding
      taxAmount = BigInt(Math.round(taxAmountNum));
    }

    // 4. Total Amount
    const totalAmount = subtotal + taxAmount;

    return {
      productId,
      quantity,
      baseUnitPrice: basePrice.toString(),
      discountedUnitPrice: discountedUnitPrice.toString(),
      subtotal: subtotal.toString(),
      discountAmount: discountAmount.toString(),
      taxRate: taxRatePercentage,
      taxAmount: taxAmount.toString(),
      totalAmount: totalAmount.toString(),
    };
  }
}
