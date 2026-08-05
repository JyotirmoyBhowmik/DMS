/**
 * PurchaseOrder Domain Entity.
 * Represents distributor replenishment purchase orders placed with suppliers and enforces state machine transitions:
 * DRAFT -> SUBMITTED -> APPROVED -> RECEIVED (or CANCELLED).
 */

export type PurchaseOrderStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'RECEIVED' | 'CANCELLED';

export interface PurchaseOrderProps {
  id: string;
  tenantId: string;
  poNumber: string;
  supplierId: string;
  warehouseId: string;
  totalAmountCents: number;
  status?: PurchaseOrderStatus;
  version?: number;
}

export class PurchaseOrder {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly poNumber: string;
  public readonly supplierId: string;
  public readonly warehouseId: string;
  private _totalAmountCents: number;
  private _status: PurchaseOrderStatus;
  private _version: number;

  public readonly domainEvents: Array<{ type: string; payload: any }> = [];

  constructor(props: PurchaseOrderProps) {
    if (!props.id || !props.tenantId || !props.poNumber || !props.supplierId || !props.warehouseId) {
      throw new Error('PurchaseOrder must have id, tenantId, poNumber, supplierId, and warehouseId');
    }
    if (props.totalAmountCents < 0) {
      throw new Error('totalAmountCents cannot be negative');
    }

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.poNumber = props.poNumber;
    this.supplierId = props.supplierId;
    this.warehouseId = props.warehouseId;
    this._totalAmountCents = props.totalAmountCents;
    this._status = props.status ?? 'DRAFT';
    this._version = props.version ?? 1;
  }

  get totalAmountCents(): number { return this._totalAmountCents; }
  get status(): PurchaseOrderStatus { return this._status; }
  get version(): number { return this._version; }

  static create(props: PurchaseOrderProps): PurchaseOrder {
    const po = new PurchaseOrder(props);
    po.domainEvents.push({
      type: 'distributor.purchase_order.created',
      payload: {
        id: po.id,
        poNumber: po.poNumber,
        supplierId: po.supplierId,
        warehouseId: po.warehouseId,
        totalAmountCents: po.totalAmountCents,
        status: po.status,
      },
    });
    return po;
  }

  updateAmount(newAmountCents: number): void {
    if (this._status !== 'DRAFT') {
      throw new Error(`Cannot update amount for PurchaseOrder in ${this._status} status`);
    }
    if (newAmountCents < 0) {
      throw new Error('totalAmountCents cannot be negative');
    }
    this._totalAmountCents = newAmountCents;
    this._version++;
  }

  updateStatus(newStatus: PurchaseOrderStatus): void {
    if (this._status === 'RECEIVED' || this._status === 'CANCELLED') {
      throw new Error(`Cannot transition from final status ${this._status}`);
    }

    const validTransitions: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
      DRAFT: ['SUBMITTED', 'CANCELLED'],
      SUBMITTED: ['APPROVED', 'CANCELLED'],
      APPROVED: ['RECEIVED', 'CANCELLED'],
      RECEIVED: [],
      CANCELLED: [],
    };

    const allowed = validTransitions[this._status];
    if (!allowed.includes(newStatus)) {
      throw new Error(`Illegal state transition from ${this._status} to ${newStatus}`);
    }

    this._status = newStatus;
    this._version++;

    this.domainEvents.push({
      type: 'distributor.purchase_order.status_updated',
      payload: { id: this.id, status: this._status, version: this._version },
    });
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      poNumber: this.poNumber,
      supplierId: this.supplierId,
      warehouseId: this.warehouseId,
      totalAmountCents: this._totalAmountCents,
      status: this._status,
      version: this._version,
    };
  }
}
