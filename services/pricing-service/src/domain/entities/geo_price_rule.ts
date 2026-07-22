/**
 * GeoPriceRule Domain Entity.
 * Represents geographic area/region specific pricing adjustments:
 * ACTIVE -> INACTIVE.
 */

export type GeoPriceRuleStatus = 'ACTIVE' | 'INACTIVE';

export interface GeoPriceRuleProps {
  id: string;
  tenantId: string;
  priceListId: string;
  regionCode: string;
  multiplier?: number;
  priceAdjustmentCents?: number;
  status?: GeoPriceRuleStatus;
  version?: number;
}

export class GeoPriceRule {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly priceListId: string;
  public readonly regionCode: string;
  private _multiplier: number;
  private _priceAdjustmentCents: number;
  private _status: GeoPriceRuleStatus;
  private _version: number;

  public readonly domainEvents: Array<{ type: string; payload: any }> = [];

  constructor(props: GeoPriceRuleProps) {
    if (!props.id || !props.tenantId || !props.priceListId || !props.regionCode) {
      throw new Error('GeoPriceRule must have id, tenantId, priceListId, and regionCode');
    }
    const mult = props.multiplier ?? 1.0;
    if (mult <= 0) {
      throw new Error('multiplier must be positive');
    }

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.priceListId = props.priceListId;
    this.regionCode = props.regionCode;
    this._multiplier = mult;
    this._priceAdjustmentCents = props.priceAdjustmentCents ?? 0;
    this._status = props.status ?? 'ACTIVE';
    this._version = props.version ?? 1;
  }

  get multiplier(): number { return this._multiplier; }
  get priceAdjustmentCents(): number { return this._priceAdjustmentCents; }
  get status(): GeoPriceRuleStatus { return this._status; }
  get version(): number { return this._version; }

  static create(props: GeoPriceRuleProps): GeoPriceRule {
    const rule = new GeoPriceRule(props);
    rule.domainEvents.push({
      type: 'pricing.geo_price_rule.created',
      payload: {
        id: rule.id,
        priceListId: rule.priceListId,
        regionCode: rule.regionCode,
        multiplier: rule.multiplier,
        priceAdjustmentCents: rule.priceAdjustmentCents,
        status: rule.status,
      },
    });
    return rule;
  }

  updateStatus(newStatus: GeoPriceRuleStatus): void {
    this._status = newStatus;
    this._version++;

    this.domainEvents.push({
      type: 'pricing.geo_price_rule.status_updated',
      payload: { id: this.id, status: this._status, version: this._version },
    });
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      priceListId: this.priceListId,
      regionCode: this.regionCode,
      multiplier: this._multiplier,
      priceAdjustmentCents: this._priceAdjustmentCents,
      status: this._status,
      version: this._version,
    };
  }
}
