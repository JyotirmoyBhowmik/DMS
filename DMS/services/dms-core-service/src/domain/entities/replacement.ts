/**
 * Replacement Domain Entity.
 * Represents inventory stock replacement issued for a returned item:
 * REQUESTED -> APPROVED -> DISPATCHED -> DELIVERED (or REJECTED).
 */

export type ReplacementStatus = 'REQUESTED' | 'APPROVED' | 'DISPATCHED' | 'DELIVERED' | 'REJECTED';

export interface ReplacementProps {
  id: string;
  tenantId: string;
  replacementNumber: string;
  returnId: string;
  outletId: string;
  warehouseId: string;
  skuId: string;
  quantity: number;
  status?: ReplacementStatus;
  version?: number;
}

export class Replacement {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly replacementNumber: string;
  public readonly returnId: string;
  public readonly outletId: string;
  public readonly warehouseId: string;
  public readonly skuId: string;
  public readonly quantity: number;
  private _status: ReplacementStatus;
  private _version: number;

  public readonly domainEvents: Array<{ type: string; payload: any }> = [];

  constructor(props: ReplacementProps) {
    if (!props.id || !props.tenantId || !props.replacementNumber || !props.returnId || !props.outletId || !props.warehouseId || !props.skuId) {
      throw new Error('Replacement must have id, tenantId, replacementNumber, returnId, outletId, warehouseId, and skuId');
    }
    if (props.quantity <= 0) {
      throw new Error('quantity must be positive');
    }

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.replacementNumber = props.replacementNumber;
    this.returnId = props.returnId;
    this.outletId = props.outletId;
    this.warehouseId = props.warehouseId;
    this.skuId = props.skuId;
    this.quantity = props.quantity;
    this._status = props.status ?? 'REQUESTED';
    this._version = props.version ?? 1;
  }

  get status(): ReplacementStatus { return this._status; }
  get version(): number { return this._version; }

  static create(props: ReplacementProps): Replacement {
    const rep = new Replacement(props);
    rep.domainEvents.push({
      type: 'distributor.replacement.created',
      payload: {
        id: rep.id,
        replacementNumber: rep.replacementNumber,
        returnId: rep.returnId,
        outletId: rep.outletId,
        warehouseId: rep.warehouseId,
        skuId: rep.skuId,
        quantity: rep.quantity,
        status: rep.status,
      },
    });
    return rep;
  }

  updateStatus(newStatus: ReplacementStatus): void {
    if (this._status === 'DELIVERED' || this._status === 'REJECTED') {
      throw new Error(`Cannot transition from final status ${this._status}`);
    }

    const validTransitions: Record<ReplacementStatus, ReplacementStatus[]> = {
      REQUESTED: ['APPROVED', 'REJECTED'],
      APPROVED: ['DISPATCHED', 'REJECTED'],
      DISPATCHED: ['DELIVERED', 'REJECTED'],
      DELIVERED: [],
      REJECTED: [],
    };

    const allowed = validTransitions[this._status];
    if (!allowed.includes(newStatus)) {
      throw new Error(`Illegal state transition from ${this._status} to ${newStatus}`);
    }

    this._status = newStatus;
    this._version++;

    this.domainEvents.push({
      type: 'distributor.replacement.status_updated',
      payload: { id: this.id, status: this._status, version: this._version },
    });
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      replacementNumber: this.replacementNumber,
      returnId: this.returnId,
      outletId: this.outletId,
      warehouseId: this.warehouseId,
      skuId: this.skuId,
      quantity: this.quantity,
      status: this._status,
      version: this._version,
    };
  }
}
