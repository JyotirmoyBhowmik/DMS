/**
 * TertiarySale Domain Entity.
 * Represents retailer-to-consumer tertiary sales transactions:
 * DRAFT -> SUBMITTED -> CONFIRMED -> DISPATCHED -> DELIVERED (or CANCELLED).
 */

export type TertiarySaleStatus = 'DRAFT' | 'SUBMITTED' | 'CONFIRMED' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';

export interface TertiarySaleProps {
  id: string;
  tenantId: string;
  invoiceNumber: string;
  consumerId: string;
  outletId: string;
  skuId: string;
  quantity: number;
  unitPriceCents: number;
  totalAmountCents: number;
  status?: TertiarySaleStatus;
  version?: number;
}

export class TertiarySale {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly invoiceNumber: string;
  public readonly consumerId: string;
  public readonly outletId: string;
  public readonly skuId: string;
  public readonly quantity: number;
  public readonly unitPriceCents: number;
  private _totalAmountCents: number;
  private _status: TertiarySaleStatus;
  private _version: number;

  public readonly domainEvents: Array<{ type: string; payload: any }> = [];

  constructor(props: TertiarySaleProps) {
    if (!props.id || !props.tenantId || !props.invoiceNumber || !props.consumerId || !props.outletId || !props.skuId) {
      throw new Error('TertiarySale must have id, tenantId, invoiceNumber, consumerId, outletId, and skuId');
    }
    if (props.quantity <= 0) {
      throw new Error('quantity must be positive');
    }
    if (props.unitPriceCents < 0 || props.totalAmountCents < 0) {
      throw new Error('unitPriceCents and totalAmountCents cannot be negative');
    }

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.invoiceNumber = props.invoiceNumber;
    this.consumerId = props.consumerId;
    this.outletId = props.outletId;
    this.skuId = props.skuId;
    this.quantity = props.quantity;
    this.unitPriceCents = props.unitPriceCents;
    this._totalAmountCents = props.totalAmountCents;
    this._status = props.status ?? 'DRAFT';
    this._version = props.version ?? 1;
  }

  get totalAmountCents(): number { return this._totalAmountCents; }
  get status(): TertiarySaleStatus { return this._status; }
  get version(): number { return this._version; }

  static create(props: TertiarySaleProps): TertiarySale {
    const sale = new TertiarySale(props);
    sale.domainEvents.push({
      type: 'distributor.tertiary_sale.created',
      payload: {
        id: sale.id,
        invoiceNumber: sale.invoiceNumber,
        consumerId: sale.consumerId,
        outletId: sale.outletId,
        skuId: sale.skuId,
        quantity: sale.quantity,
        unitPriceCents: sale.unitPriceCents,
        totalAmountCents: sale.totalAmountCents,
        status: sale.status,
      },
    });
    return sale;
  }

  updateStatus(newStatus: TertiarySaleStatus): void {
    if (this._status === 'DELIVERED' || this._status === 'CANCELLED') {
      throw new Error(`Cannot transition from final status ${this._status}`);
    }

    const validTransitions: Record<TertiarySaleStatus, TertiarySaleStatus[]> = {
      DRAFT: ['SUBMITTED', 'CANCELLED'],
      SUBMITTED: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['DISPATCHED', 'CANCELLED'],
      DISPATCHED: ['DELIVERED', 'CANCELLED'],
      DELIVERED: [],
      CANCELLED: [],
    };

    const allowed = validTransitions[this._status];
    if (!allowed.includes(newStatus)) {
      throw new Error(`Illegal state transition from ${this._status} to ${newStatus}`);
    }

    this._status = newStatus;
    this._version++;

    this.domainEvents.push({
      type: 'distributor.tertiary_sale.status_updated',
      payload: { id: this.id, status: this._status, version: this._version },
    });
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      invoiceNumber: this.invoiceNumber,
      consumerId: this.consumerId,
      outletId: this.outletId,
      skuId: this.skuId,
      quantity: this.quantity,
      unitPriceCents: this.unitPriceCents,
      totalAmountCents: this._totalAmountCents,
      status: this._status,
      version: this._version,
    };
  }
}
