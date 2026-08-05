/**
 * PriceSlab Domain Entity.
 * Represents tiered quantity pricing rules:
 * ACTIVE -> INACTIVE.
 */

export type PriceSlabStatus = 'ACTIVE' | 'INACTIVE';

export interface PriceSlabProps {
  id: string;
  tenantId: string;
  priceListId: string;
  skuId: string;
  minQuantity: number;
  maxQuantity: number;
  priceCents: number;
  status?: PriceSlabStatus;
  version?: number;
}

export class PriceSlab {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly priceListId: string;
  public readonly skuId: string;
  public readonly minQuantity: number;
  public readonly maxQuantity: number;
  private _priceCents: number;
  private _status: PriceSlabStatus;
  private _version: number;

  public readonly domainEvents: Array<{ type: string; payload: any }> = [];

  constructor(props: PriceSlabProps) {
    if (!props.id || !props.tenantId || !props.priceListId || !props.skuId) {
      throw new Error('PriceSlab must have id, tenantId, priceListId, and skuId');
    }
    if (props.minQuantity <= 0) {
      throw new Error('minQuantity must be positive');
    }
    if (props.maxQuantity < props.minQuantity) {
      throw new Error('maxQuantity cannot be less than minQuantity');
    }
    if (props.priceCents < 0) {
      throw new Error('priceCents cannot be negative');
    }

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.priceListId = props.priceListId;
    this.skuId = props.skuId;
    this.minQuantity = props.minQuantity;
    this.maxQuantity = props.maxQuantity;
    this._priceCents = props.priceCents;
    this._status = props.status ?? 'ACTIVE';
    this._version = props.version ?? 1;
  }

  get priceCents(): number { return this._priceCents; }
  get status(): PriceSlabStatus { return this._status; }
  get version(): number { return this._version; }

  static create(props: PriceSlabProps): PriceSlab {
    const slab = new PriceSlab(props);
    slab.domainEvents.push({
      type: 'pricing.price_slab.created',
      payload: {
        id: slab.id,
        priceListId: slab.priceListId,
        skuId: slab.skuId,
        minQuantity: slab.minQuantity,
        maxQuantity: slab.maxQuantity,
        priceCents: slab.priceCents,
        status: slab.status,
      },
    });
    return slab;
  }

  updateStatus(newStatus: PriceSlabStatus): void {
    this._status = newStatus;
    this._version++;

    this.domainEvents.push({
      type: 'pricing.price_slab.status_updated',
      payload: { id: this.id, status: this._status, version: this._version },
    });
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      priceListId: this.priceListId,
      skuId: this.skuId,
      minQuantity: this.minQuantity,
      maxQuantity: this.maxQuantity,
      priceCents: this._priceCents,
      status: this._status,
      version: this._version,
    };
  }
}
