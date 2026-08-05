/**
 * StockTransfer Domain Entity.
 * Manages inter-warehouse stock movements with approval workflow.
 * State machine: REQUESTED -> APPROVED -> IN_TRANSIT -> RECEIVED -> CLOSED (or REJECTED)
 */

export type StockTransferStatus = 'REQUESTED' | 'APPROVED' | 'IN_TRANSIT' | 'RECEIVED' | 'CLOSED' | 'REJECTED';

export interface StockTransferItem {
  id?: string;
  productId: string;
  batchNumber: string;
  quantity: number;
  expiryDate: string; // ISO-8601 date
  receivedQuantity?: number;
}

export interface StockTransferProps {
  id: string;
  tenantId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  items: StockTransferItem[];
  status?: StockTransferStatus;
  requestedBy: string;
  approvedBy?: string;
  transferDate?: string;
  receivedAt?: string;
  receivedBy?: string;
  discrepancyNotes?: string;
  version?: number;
}

export class StockTransfer {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly fromWarehouseId: string;
  public readonly toWarehouseId: string;
  public readonly requestedBy: string;
  private _items: StockTransferItem[];
  private _status: StockTransferStatus;
  private _approvedBy?: string;
  private _transferDate?: string;
  private _receivedAt?: string;
  private _receivedBy?: string;
  private _discrepancyNotes?: string;
  private _version: number;

  constructor(props: StockTransferProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.fromWarehouseId = props.fromWarehouseId;
    this.toWarehouseId = props.toWarehouseId;
    this.requestedBy = props.requestedBy;
    this._items = [...props.items];
    this._status = props.status ?? 'REQUESTED';
    this._approvedBy = props.approvedBy;
    this._transferDate = props.transferDate;
    this._receivedAt = props.receivedAt;
    this._receivedBy = props.receivedBy;
    this._discrepancyNotes = props.discrepancyNotes;
    this._version = props.version ?? 1;
  }

  get items(): StockTransferItem[] { return [...this._items]; }
  get status(): StockTransferStatus { return this._status; }
  get approvedBy(): string | undefined { return this._approvedBy; }
  get transferDate(): string | undefined { return this._transferDate; }
  get receivedAt(): string | undefined { return this._receivedAt; }
  get receivedBy(): string | undefined { return this._receivedBy; }
  get discrepancyNotes(): string | undefined { return this._discrepancyNotes; }
  get version(): number { return this._version; }

  static create(props: StockTransferProps): StockTransfer {
    if (props.fromWarehouseId === props.toWarehouseId) {
      throw new Error('Source and destination warehouses must be different');
    }
    if (!props.items || props.items.length === 0) {
      throw new Error('At least one item is required for a stock transfer');
    }
    for (const item of props.items) {
      if (item.quantity <= 0) {
        throw new Error(`Quantity must be positive for product ${item.productId}`);
      }
    }
    return new StockTransfer(props);
  }

  approve(approvedBy: string): void {
    if (this._status !== 'REQUESTED') {
      throw new Error(`Cannot approve transfer in ${this._status} status`);
    }
    this._approvedBy = approvedBy;
    this._status = 'APPROVED';
    this._version++;
  }

  reject(reason: string): void {
    if (this._status !== 'REQUESTED' && this._status !== 'APPROVED') {
      throw new Error(`Cannot reject transfer in ${this._status} status`);
    }
    if (!reason.trim()) {
      throw new Error('Rejection reason is required');
    }
    this._discrepancyNotes = reason;
    this._status = 'REJECTED';
    this._version++;
  }

  markInTransit(transferDate?: string): void {
    if (this._status !== 'APPROVED') {
      throw new Error(`Cannot mark in-transit from ${this._status} status`);
    }
    this._transferDate = transferDate ?? new Date().toISOString();
    this._status = 'IN_TRANSIT';
    this._version++;
  }

  receive(receivedBy: string, receivedItems: Array<{ productId: string; batchNumber: string; receivedQuantity: number }>, discrepancyNotes?: string): void {
    if (this._status !== 'IN_TRANSIT') {
      throw new Error(`Cannot receive transfer in ${this._status} status`);
    }

    // Update received quantities
    for (const ri of receivedItems) {
      const item = this._items.find(i => i.productId === ri.productId && i.batchNumber === ri.batchNumber);
      if (item) {
        item.receivedQuantity = ri.receivedQuantity;
      }
    }

    this._receivedBy = receivedBy;
    this._receivedAt = new Date().toISOString();
    this._discrepancyNotes = discrepancyNotes;
    this._status = 'RECEIVED';
    this._version++;
  }

  close(): void {
    if (this._status !== 'RECEIVED') {
      throw new Error(`Cannot close transfer in ${this._status} status`);
    }
    this._status = 'CLOSED';
    this._version++;
  }

  /**
   * Checks if there are quantity discrepancies between sent and received items.
   */
  hasDiscrepancies(): boolean {
    return this._items.some(i =>
      i.receivedQuantity !== undefined && i.receivedQuantity !== i.quantity
    );
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      fromWarehouseId: this.fromWarehouseId,
      toWarehouseId: this.toWarehouseId,
      items: this._items,
      status: this._status,
      requestedBy: this.requestedBy,
      approvedBy: this._approvedBy,
      transferDate: this._transferDate,
      receivedAt: this._receivedAt,
      receivedBy: this._receivedBy,
      discrepancyNotes: this._discrepancyNotes,
      version: this._version,
    };
  }
}
