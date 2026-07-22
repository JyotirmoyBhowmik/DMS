/**
 * StockTransfer Domain Entity.
 * Represents an inter-warehouse stock transfer request and enforces valid state machine transitions:
 * REQUESTED -> APPROVED -> IN_TRANSIT -> COMPLETED (or CANCELLED).
 */

export type StockTransferStatus = 'REQUESTED' | 'APPROVED' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';

export interface StockTransferProps {
  id: string;
  tenantId: string;
  transferNumber: string;
  sourceWarehouseId: string;
  targetWarehouseId: string;
  skuId: string;
  quantity: number;
  status?: StockTransferStatus;
  version?: number;
}

export class StockTransfer {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly transferNumber: string;
  public readonly sourceWarehouseId: string;
  public readonly targetWarehouseId: string;
  public readonly skuId: string;
  public readonly quantity: number;
  private _status: StockTransferStatus;
  private _version: number;

  public readonly domainEvents: Array<{ type: string; payload: any }> = [];

  constructor(props: StockTransferProps) {
    if (!props.id || !props.tenantId || !props.transferNumber || !props.sourceWarehouseId || !props.targetWarehouseId || !props.skuId) {
      throw new Error('StockTransfer must have id, tenantId, transferNumber, sourceWarehouseId, targetWarehouseId, and skuId');
    }
    if (props.sourceWarehouseId === props.targetWarehouseId) {
      throw new Error('sourceWarehouseId and targetWarehouseId cannot be identical');
    }
    if (props.quantity <= 0) {
      throw new Error('quantity must be positive');
    }

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.transferNumber = props.transferNumber;
    this.sourceWarehouseId = props.sourceWarehouseId;
    this.targetWarehouseId = props.targetWarehouseId;
    this.skuId = props.skuId;
    this.quantity = props.quantity;
    this._status = props.status ?? 'REQUESTED';
    this._version = props.version ?? 1;
  }

  get status(): StockTransferStatus { return this._status; }
  get version(): number { return this._version; }

  static create(props: StockTransferProps): StockTransfer {
    const transfer = new StockTransfer(props);
    transfer.domainEvents.push({
      type: 'distributor.stock_transfer.created',
      payload: {
        id: transfer.id,
        transferNumber: transfer.transferNumber,
        sourceWarehouseId: transfer.sourceWarehouseId,
        targetWarehouseId: transfer.targetWarehouseId,
        skuId: transfer.skuId,
        quantity: transfer.quantity,
        status: transfer.status,
      },
    });
    return transfer;
  }

  updateStatus(newStatus: StockTransferStatus): void {
    if (this._status === 'COMPLETED' || this._status === 'CANCELLED') {
      throw new Error(`Cannot transition from final status ${this._status}`);
    }

    const validTransitions: Record<StockTransferStatus, StockTransferStatus[]> = {
      REQUESTED: ['APPROVED', 'CANCELLED'],
      APPROVED: ['IN_TRANSIT', 'CANCELLED'],
      IN_TRANSIT: ['COMPLETED', 'CANCELLED'],
      COMPLETED: [],
      CANCELLED: [],
    };

    const allowed = validTransitions[this._status];
    if (!allowed.includes(newStatus)) {
      throw new Error(`Illegal state transition from ${this._status} to ${newStatus}`);
    }

    this._status = newStatus;
    this._version++;

    this.domainEvents.push({
      type: 'distributor.stock_transfer.status_updated',
      payload: { id: this.id, status: this._status, version: this._version },
    });
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      transferNumber: this.transferNumber,
      sourceWarehouseId: this.sourceWarehouseId,
      targetWarehouseId: this.targetWarehouseId,
      skuId: this.skuId,
      quantity: this.quantity,
      status: this._status,
      version: this._version,
    };
  }
}
