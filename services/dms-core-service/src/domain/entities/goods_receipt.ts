/**
 * GoodsReceipt Domain Entity.
 * Represents incoming warehouse inventory receipt from a Purchase Order (PO) and enforces state machine transitions:
 * DRAFT -> VERIFIED -> POSTED (or REJECTED).
 */

export type GoodsReceiptStatus = 'DRAFT' | 'VERIFIED' | 'POSTED' | 'REJECTED';

export interface GoodsReceiptProps {
  id: string;
  tenantId: string;
  receiptNumber: string;
  purchaseOrderId: string;
  warehouseId: string;
  skuId: string;
  receivedQuantity: number;
  status?: GoodsReceiptStatus;
  version?: number;
}

export class GoodsReceipt {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly receiptNumber: string;
  public readonly purchaseOrderId: string;
  public readonly warehouseId: string;
  public readonly skuId: string;
  public readonly receivedQuantity: number;
  private _status: GoodsReceiptStatus;
  private _version: number;

  public readonly domainEvents: Array<{ type: string; payload: any }> = [];

  constructor(props: GoodsReceiptProps) {
    if (!props.id || !props.tenantId || !props.receiptNumber || !props.purchaseOrderId || !props.warehouseId || !props.skuId) {
      throw new Error('GoodsReceipt must have id, tenantId, receiptNumber, purchaseOrderId, warehouseId, and skuId');
    }
    if (props.receivedQuantity <= 0) {
      throw new Error('receivedQuantity must be positive');
    }

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.receiptNumber = props.receiptNumber;
    this.purchaseOrderId = props.purchaseOrderId;
    this.warehouseId = props.warehouseId;
    this.skuId = props.skuId;
    this.receivedQuantity = props.receivedQuantity;
    this._status = props.status ?? 'DRAFT';
    this._version = props.version ?? 1;
  }

  get status(): GoodsReceiptStatus { return this._status; }
  get version(): number { return this._version; }

  static create(props: GoodsReceiptProps): GoodsReceipt {
    const gr = new GoodsReceipt(props);
    gr.domainEvents.push({
      type: 'distributor.goods_receipt.created',
      payload: {
        id: gr.id,
        receiptNumber: gr.receiptNumber,
        purchaseOrderId: gr.purchaseOrderId,
        warehouseId: gr.warehouseId,
        skuId: gr.skuId,
        receivedQuantity: gr.receivedQuantity,
        status: gr.status,
      },
    });
    return gr;
  }

  updateStatus(newStatus: GoodsReceiptStatus): void {
    if (this._status === 'POSTED' || this._status === 'REJECTED') {
      throw new Error(`Cannot transition from final status ${this._status}`);
    }

    const validTransitions: Record<GoodsReceiptStatus, GoodsReceiptStatus[]> = {
      DRAFT: ['VERIFIED', 'REJECTED'],
      VERIFIED: ['POSTED', 'REJECTED'],
      POSTED: [],
      REJECTED: [],
    };

    const allowed = validTransitions[this._status];
    if (!allowed.includes(newStatus)) {
      throw new Error(`Illegal state transition from ${this._status} to ${newStatus}`);
    }

    this._status = newStatus;
    this._version++;

    this.domainEvents.push({
      type: 'distributor.goods_receipt.status_updated',
      payload: { id: this.id, status: this._status, version: this._version },
    });
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      receiptNumber: this.receiptNumber,
      purchaseOrderId: this.purchaseOrderId,
      warehouseId: this.warehouseId,
      skuId: this.skuId,
      receivedQuantity: this.receivedQuantity,
      status: this._status,
      version: this._version,
    };
  }
}
