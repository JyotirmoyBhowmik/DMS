export interface QuantityBreak {
  minQuantity: number;
  discountPercentage: number; // e.g. 5 = 5% discount
}

export interface PricingResult {
  listPrice: number;
  discountedUnitPrice: number;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  taxRatePct: number;
}

export class PricingPolicy {
  // Quantity breaks for volume pricing discounts
  private static qtyBreaks: QuantityBreak[] = [
    { minQuantity: 100, discountPercentage: 10 }, // 10% discount for 100+ units
    { minQuantity: 50, discountPercentage: 5 },   // 5% discount for 50+ units
    { minQuantity: 20, discountPercentage: 2 },   // 2% discount for 20+ units
  ];

  // GST rates based on standard rules (FMCG is generally 18%)
  private static taxRules: Record<string, number> = {
    'GST_ZERO': 0,
    'GST_5': 5,
    'GST_12': 12,
    'GST_18': 18,
    'GST_28': 28,
  };

  static calculate(
    listPrice: number,
    quantity: number,
    taxRuleKey = 'GST_18'
  ): PricingResult {
    if (listPrice < 0 || quantity <= 0) {
      throw new Error('List price must be non-negative and quantity must be positive');
    }

    // 1. Determine discount percentage based on quantity breaks (highest matching tier)
    let discountPct = 0;
    const sortedBreaks = [...this.qtyBreaks].sort((a, b) => b.minQuantity - a.minQuantity);
    
    for (const qb of sortedBreaks) {
      if (quantity >= qb.minQuantity) {
        discountPct = qb.discountPercentage;
        break;
      }
    }

    // 2. Compute discounted unit price
    const discountFactor = (100 - discountPct) / 100;
    // Use Math.round to handle integer-based cents/paise values precisely
    const discountedUnitPrice = Math.round(listPrice * discountFactor);
    
    const subtotal = discountedUnitPrice * quantity;
    const discountAmount = (listPrice - discountedUnitPrice) * quantity;

    // 3. Compute tax amount based on target tax rules
    const taxRatePct = this.taxRules[taxRuleKey] ?? 18;
    const taxAmount = Math.round(subtotal * (taxRatePct / 100));

    const totalAmount = subtotal + taxAmount;

    return {
      listPrice,
      discountedUnitPrice,
      subtotal,
      discountAmount,
      taxAmount,
      totalAmount,
      taxRatePct,
    };
  }
}
