/**
 * ChannelPriceRule Domain Entity.
 * Represents distribution channel specific pricing adjustments:
 * ACTIVE -> INACTIVE.
 */

export type ChannelPriceRuleStatus = 'ACTIVE' | 'INACTIVE';
export type ChannelCode = 'GT' | 'MT' | 'ECOM' | 'INSTITUTIONAL';

export interface ChannelPriceRuleProps {
  id: string;
  tenantId: string;
  priceListId: string;
  channelCode: ChannelCode;
  multiplier?: number;
  priceAdjustmentCents?: number;
  status?: ChannelPriceRuleStatus;
  version?: number;
}

export class ChannelPriceRule {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly priceListId: string;
  public readonly channelCode: ChannelCode;
  private _multiplier: number;
  private _priceAdjustmentCents: number;
  private _status: ChannelPriceRuleStatus;
  private _version: number;

  public readonly domainEvents: Array<{ type: string; payload: any }> = [];

  constructor(props: ChannelPriceRuleProps) {
    if (!props.id || !props.tenantId || !props.priceListId || !props.channelCode) {
      throw new Error('ChannelPriceRule must have id, tenantId, priceListId, and channelCode');
    }
    const mult = props.multiplier ?? 1.0;
    if (mult <= 0) {
      throw new Error('multiplier must be positive');
    }

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.priceListId = props.priceListId;
    this.channelCode = props.channelCode;
    this._multiplier = mult;
    this._priceAdjustmentCents = props.priceAdjustmentCents ?? 0;
    this._status = props.status ?? 'ACTIVE';
    this._version = props.version ?? 1;
  }

  get multiplier(): number { return this._multiplier; }
  get priceAdjustmentCents(): number { return this._priceAdjustmentCents; }
  get status(): ChannelPriceRuleStatus { return this._status; }
  get version(): number { return this._version; }

  static create(props: ChannelPriceRuleProps): ChannelPriceRule {
    const rule = new ChannelPriceRule(props);
    rule.domainEvents.push({
      type: 'pricing.channel_price_rule.created',
      payload: {
        id: rule.id,
        priceListId: rule.priceListId,
        channelCode: rule.channelCode,
        multiplier: rule.multiplier,
        priceAdjustmentCents: rule.priceAdjustmentCents,
        status: rule.status,
      },
    });
    return rule;
  }

  updateStatus(newStatus: ChannelPriceRuleStatus): void {
    this._status = newStatus;
    this._version++;

    this.domainEvents.push({
      type: 'pricing.channel_price_rule.status_updated',
      payload: { id: this.id, status: this._status, version: this._version },
    });
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      priceListId: this.priceListId,
      channelCode: this.channelCode,
      multiplier: this._multiplier,
      priceAdjustmentCents: this._priceAdjustmentCents,
      status: this._status,
      version: this._version,
    };
  }
}
