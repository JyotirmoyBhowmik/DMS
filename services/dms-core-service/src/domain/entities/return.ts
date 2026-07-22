/**
 * Return / SalesReturn Domain Entity.
 * Represents an outlet stock return to warehouse and enforces state machine transitions:
 * REQUESTED -> APPROVED -> INSPECTED -> REFUNDED (or REJECTED).
 */

export type ReturnStatus = 'REQUESTED' | 'APPROVED' | 'INSPECTED' | 'REFUNDED' | 'REJECTED';

export interface ReturnProps {
  id: string;
  tenantId: string;
  returnNumber: string;
  outletId: string;
  warehouseId: string;
  skuId: string;
  quantity: number;
  reason: string;
  totalAmountCents: number;
  status?: ReturnStatus;
  version?: number;
}

export class ReturnEntity {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly returnNumber: string;
  public readonly outletId: string;
  public readonly warehouseId: string;
  public readonly skuId: string;
  public readonly quantity: number;
  public readonly reason: string;
  private _totalAmountCents: number;
  private _status: ReturnStatus;
  private _version: number;

  public readonly domainEvents: Array<{ type: string; payload: any }> = [];

  constructor(props: ReturnProps) {
    if (!props.id || !props.tenantId || !props.returnNumber || !props.outletId || !props.warehouseId || !props.skuId) {
      throw new Error('Return must have id, tenantId, returnNumber, outletId, warehouseId, and skuId');
    }
    if (props.quantity <= 0) {
      throw new Error('quantity must be positive');
    }
    if (props.totalAmountCents < 0) {
      throw new Error('totalAmountCents cannot be negative');
    }

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.returnNumber = props.returnNumber;
    this.outletId = props.outletId;
    this.warehouseId = props.warehouseId;
    this.skuId = props.skuId;
    this.quantity = props.quantity;
    this.reason = props.reason;
    this._totalAmountCents = props.totalAmountCents;
    this._status = props.status ?? 'REQUESTED';
    this._version = props.version ?? 1;
  }

  get totalAmountCents(): number { return this._totalAmountCents; }
  get status(): ReturnStatus { return this._status; }
  get version(): number { return this._version; }

  static create(props: ReturnProps): ReturnEntity {
    const ret = new ReturnEntity(props);
    ret.domainEvents.push({
      type: 'distributor.return.created',
      payload: {
        id: ret.id,
        returnNumber: ret.returnNumber,
        outletId: ret.outletId,
        warehouseId: ret.warehouseId,
        skuId: ret.skuId,
        quantity: ret.quantity,
        reason: ret.reason,
        totalAmountCents: ret.totalAmountCents,
        status: ret.status,
      },
    });
    return ret;
  }

  updateStatus(newStatus: ReturnStatus): void {
    if (this._status === 'REFUNDED' || this._status === 'REJECTED') {
      throw new Error(`Cannot transition from final status ${this._status}`);
    }

    const validTransitions: Record<ReturnStatus, ReturnStatus[]> = {
      REQUESTED: ['APPROVED', 'REJECTED'],
      APPROVED: ['INSPECTED', 'REJECTED'],
      INSPECTED: ['REFUNDED', 'REJECTED'],
      REFUNDED: [],
      REJECTED: [],
    };

    const allowed = validTransitions[this._status];
    if (!allowed.includes(newStatus)) {
      throw new Error(`Illegal state transition from ${this._status} to ${newStatus}`);
    }

    this._status = newStatus;
    this._version++;

    this.domainEvents.push({
      type: 'distributor.return.status_updated',
      payload: { id: this.id, status: this._status, version: this._version },
    });
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      returnNumber: this.returnNumber,
      outletId: this.outletId,
      warehouseId: this.warehouseId,
      skuId: this.skuId,
      quantity: this.quantity,
      reason: this.reason,
      totalAmountCents: this._totalAmountCents,
      status: this._status,
      version: this._version,
    };
  }
}
