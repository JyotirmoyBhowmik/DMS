export interface PriceListEntryTier {
  id: string;
  entryId: string;
  minQuantity: number;
  discountPercentage?: number; // 0 to 100
  discountFlat?: bigint; // flat discount amount in minor unit
}

export class PriceListEntryEntity {
  id: string;
  priceListId: string;
  productId: string;
  basePrice: bigint; // minor unit (e.g. cents/paise)
  mrp: bigint; // minor unit
  taxRuleKey: string; // e.g. 'GST_18', 'GST_5', 'VAT_12'
  roundingRule: string; // e.g. 'HALF_UP', 'CEIL', 'FLOOR'
  tiers: PriceListEntryTier[];
  createdAt?: Date;
  updatedAt?: Date;

  constructor(data: Partial<PriceListEntryEntity>) {
    this.id = data.id || '';
    this.priceListId = data.priceListId || '';
    this.productId = data.productId || '';
    
    // Support initialization from number or string or bigint
    this.basePrice = data.basePrice !== undefined ? BigInt(data.basePrice.toString()) : 0n;
    this.mrp = data.mrp !== undefined ? BigInt(data.mrp.toString()) : 0n;
    
    this.taxRuleKey = data.taxRuleKey || 'GST_18';
    this.roundingRule = data.roundingRule || 'HALF_UP';
    this.tiers = (data.tiers || []).map(t => ({
      id: t.id || '',
      entryId: t.entryId || '',
      minQuantity: t.minQuantity || 1,
      discountPercentage: t.discountPercentage !== undefined ? Number(t.discountPercentage) : undefined,
      discountFlat: t.discountFlat !== undefined ? BigInt(t.discountFlat.toString()) : undefined,
    }));
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }
}
