/**
 * SchemePromotion Domain Entity.
 * Represents promotional rules linked to a Scheme:
 * ACTIVE -> PAUSED / EXPIRED / CANCELLED.
 */

export type SchemePromotionStatus = 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'CANCELLED';
export type PromotionType = 'PERCENTAGE_DISCOUNT' | 'FLAT_REBATE' | 'FREE_GOODS';

export interface SchemePromotionProps {
  id: string;
  tenantId: string;
  schemeId: string;
  name: string;
  promoCode: string;
  promotionType?: PromotionType;
  discountPercentage?: number;
  maxDiscountCents?: number;
  status?: SchemePromotionStatus;
  version?: number;
}

export class SchemePromotion {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly schemeId: string;
  private _name: string;
  public readonly promoCode: string;
  public readonly promotionType: PromotionType;
  private _discountPercentage: number;
  private _maxDiscountCents: number;
  private _status: SchemePromotionStatus;
  private _version: number;

  public readonly domainEvents: Array<{ type: string; payload: any }> = [];

  constructor(props: SchemePromotionProps) {
    if (!props.id || !props.tenantId || !props.schemeId || !props.name || !props.promoCode) {
      throw new Error('SchemePromotion must have id, tenantId, schemeId, name, and promoCode');
    }
    if (props.discountPercentage !== undefined && (props.discountPercentage < 0 || props.discountPercentage > 100)) {
      throw new Error('discountPercentage must be between 0 and 100');
    }

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.schemeId = props.schemeId;
    this._name = props.name;
    this.promoCode = props.promoCode;
    this.promotionType = props.promotionType ?? 'PERCENTAGE_DISCOUNT';
    this._discountPercentage = props.discountPercentage ?? 0;
    this._maxDiscountCents = props.maxDiscountCents ?? 0;
    this._status = props.status ?? 'ACTIVE';
    this._version = props.version ?? 1;
  }

  get name(): string { return this._name; }
  get discountPercentage(): number { return this._discountPercentage; }
  get maxDiscountCents(): number { return this._maxDiscountCents; }
  get status(): SchemePromotionStatus { return this._status; }
  get version(): number { return this._version; }

  static create(props: SchemePromotionProps): SchemePromotion {
    const promo = new SchemePromotion(props);
    promo.domainEvents.push({
      type: 'schemes.scheme_promotion.created',
      payload: {
        id: promo.id,
        schemeId: promo.schemeId,
        name: promo.name,
        promoCode: promo.promoCode,
        promotionType: promo.promotionType,
        status: promo.status,
      },
    });
    return promo;
  }

  updateStatus(newStatus: SchemePromotionStatus): void {
    if (this._status === 'CANCELLED') {
      throw new Error(`Cannot transition from final status CANCELLED`);
    }

    this._status = newStatus;
    this._version++;

    this.domainEvents.push({
      type: 'schemes.scheme_promotion.status_updated',
      payload: { id: this.id, status: this._status, version: this._version },
    });
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      schemeId: this.schemeId,
      name: this._name,
      promoCode: this.promoCode,
      promotionType: this.promotionType,
      discountPercentage: this._discountPercentage,
      maxDiscountCents: this._maxDiscountCents,
      status: this._status,
      version: this._version,
    };
  }
}
