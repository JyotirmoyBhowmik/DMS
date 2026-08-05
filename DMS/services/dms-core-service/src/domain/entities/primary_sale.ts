/**
 * PrimarySale Domain Entity.
 * Represents manufacturer-to-distributor primary sales transactions:
 * DRAFT -> SUBMITTED -> CONFIRMED -> DISPATCHED -> DELIVERED (or CANCELLED).
 */

export type PrimarySaleStatus = 'DRAFT' | 'SUBMITTED' | 'CONFIRMED' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';

export interface PrimarySaleProps {
  id: string;
  tenantId: string;
  invoiceNumber: string;
  distributorId: string;
  warehouseId: string;
  skuId: string;
  quantity: number;
  unitPriceCents: number;
  totalAmountCents: number;
  status?: PrimarySaleStatus;
  version?: number;
}

export class PrimarySale {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly invoiceNumber: string;
  public readonly distributorId: string;
  public readonly warehouseId: string;
  public readonly skuId: string;
  public readonly quantity: number;
  public readonly unitPriceCents: number;
  private _totalAmountCents: number;
  private _status: PrimarySaleStatus;
  private _version: number;

  public readonly domainEvents: Array<{ type: string; payload: any }> = [];

  constructor(props: PrimarySaleProps) {
    if (!props.id || !props.tenantId || !props.invoiceNumber || !props.distributorId || !props.warehouseId || !props.skuId) {
      throw new Error('PrimarySale must have id, tenantId, invoiceNumber, distributorId, warehouseId, and skuId');
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
    this.distributorId = props.distributorId;
    this.warehouseId = props.warehouseId;
    this.skuId = props.skuId;
    this.quantity = props.quantity;
    this.unitPriceCents = props.unitPriceCents;
    this._totalAmountCents = props.totalAmountCents;
    this._status = props.status ?? 'DRAFT';
    this._version = props.version ?? 1;
  }

  get totalAmountCents(): number { return this._totalAmountCents; }
  get status(): PrimarySaleStatus { return this._status; }
  get version(): number { return this._version; }

  static create(props: PrimarySaleProps): PrimarySale {
    const sale = new PrimarySale(props);
    sale.domainEvents.push({
      type: 'distributor.primary_sale.created',
      payload: {
        id: sale.id,
        invoiceNumber: sale.invoiceNumber,
        distributorId: sale.distributorId,
        warehouseId: sale.warehouseId,
        skuId: sale.skuId,
        quantity: sale.quantity,
        unitPriceCents: sale.unitPriceCents,
        totalAmountCents: sale.totalAmountCents,
        status: sale.status,
      },
    });
    return sale;
  }

  updateStatus(newStatus: PrimarySaleStatus): void {
    if (this._status === 'DELIVERED' || this._status === 'CANCELLED') {
      throw new Error(`Cannot transition from final status ${this._status}`);
    }

    const validTransitions: Record<PrimarySaleStatus, PrimarySaleStatus[]> = {
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
      type: 'distributor.primary_sale.status_updated',
      payload: { id: this.id, status: this._status, version: this._version },
    });
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      invoiceNumber: this.invoiceNumber,
      distributorId: this.distributorId,
      warehouseId: this.warehouseId,
      skuId: this.skuId,
      quantity: this.quantity,
      unitPriceCents: this.unitPriceCents,
      totalAmountCents: this._totalAmountCents,
      status: this._status,
      version: this._version,
    };
  }
}
