/**
 * Batch Domain Entity.
 * Extends inventory management with FEFO (First Expiry, First Out) batch tracking.
 */

export type BatchStatus = 'ACTIVE' | 'QUARANTINED' | 'EXPIRED' | 'RECALLED';

const QUARANTINE_THRESHOLD_DAYS = 30;

export interface BatchProps {
  id: string;
  tenantId: string;
  productId: string;
  batchNumber: string;
  manufacturingDate: string; // ISO-8601 date
  expiryDate: string;
  quantity?: number;
  quarantineQuantity?: number;
  status?: BatchStatus;
  mfgLotNumber?: string;
  version?: number;
}

export class Batch {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly productId: string;
  public readonly batchNumber: string;
  public readonly manufacturingDate: string;
  public readonly expiryDate: string;
  private _quantity: number;
  private _quarantineQuantity: number;
  private _status: BatchStatus;
  private _mfgLotNumber?: string;
  private _version: number;

  constructor(props: BatchProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.productId = props.productId;
    this.batchNumber = props.batchNumber;
    this.manufacturingDate = props.manufacturingDate;
    this.expiryDate = props.expiryDate;
    this._quantity = props.quantity ?? 0;
    this._quarantineQuantity = props.quarantineQuantity ?? 0;
    this._status = props.status ?? 'ACTIVE';
    this._mfgLotNumber = props.mfgLotNumber;
    this._version = props.version ?? 1;
  }

  get quantity(): number { return this._quantity; }
  get quarantineQuantity(): number { return this._quarantineQuantity; }
  get status(): BatchStatus { return this._status; }
  get mfgLotNumber(): string | undefined { return this._mfgLotNumber; }
  get version(): number { return this._version; }

  /**
   * Available quantity = total - quarantined
   */
  get availableQuantity(): number {
    return this._quantity - this._quarantineQuantity;
  }

  /**
   * Days until expiry from now.
   */
  get daysUntilExpiry(): number {
    const now = new Date();
    const expiry = new Date(this.expiryDate);
    return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  /**
   * Whether this batch should be auto-quarantined (within 30 days of expiry).
   */
  get shouldAutoQuarantine(): boolean {
    return this._status === 'ACTIVE' && this.daysUntilExpiry <= QUARANTINE_THRESHOLD_DAYS && this.daysUntilExpiry > 0;
  }

  /**
   * Whether this batch is expired.
   */
  get isExpired(): boolean {
    return this.daysUntilExpiry <= 0;
  }

  static create(props: BatchProps): Batch {
    if (new Date(props.expiryDate) <= new Date(props.manufacturingDate)) {
      throw new Error('Expiry date must be after manufacturing date');
    }
    return new Batch(props);
  }

  /**
   * FEFO: sorts batches by expiry date ascending (first expiry first).
   */
  static sortByFEFO(batches: Batch[]): Batch[] {
    return [...batches].sort((a, b) =>
      new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()
    );
  }

  addStock(quantity: number): void {
    if (quantity <= 0) throw new Error('Quantity must be positive');
    if (this._status === 'EXPIRED' || this._status === 'RECALLED') {
      throw new Error(`Cannot add stock to ${this._status} batch`);
    }
    this._quantity += quantity;
    this._version++;
  }

  deductStock(quantity: number): void {
    if (quantity <= 0) throw new Error('Quantity must be positive');
    if (quantity > this.availableQuantity) {
      throw new Error(`Insufficient available stock. Available: ${this.availableQuantity}, Requested: ${quantity}`);
    }
    this._quantity -= quantity;
    // Auto-close if zero stock
    if (this._quantity === 0 && this._quarantineQuantity === 0) {
      this._status = 'EXPIRED'; // Batch depleted
    }
    this._version++;
  }

  quarantine(quantity?: number): void {
    if (this._status !== 'ACTIVE') {
      throw new Error(`Cannot quarantine batch in ${this._status} status`);
    }
    const qtyToQuarantine = quantity ?? this.availableQuantity;
    if (qtyToQuarantine > this.availableQuantity) {
      throw new Error(`Cannot quarantine ${qtyToQuarantine}. Available: ${this.availableQuantity}`);
    }
    this._quarantineQuantity += qtyToQuarantine;
    this._status = 'QUARANTINED';
    this._version++;
  }

  releaseFromQuarantine(quantity?: number): void {
    if (this._status !== 'QUARANTINED') {
      throw new Error(`Cannot release from quarantine in ${this._status} status`);
    }
    const qtyToRelease = quantity ?? this._quarantineQuantity;
    if (qtyToRelease > this._quarantineQuantity) {
      throw new Error(`Cannot release ${qtyToRelease}. Quarantined: ${this._quarantineQuantity}`);
    }
    this._quarantineQuantity -= qtyToRelease;
    if (this._quarantineQuantity === 0) {
      this._status = 'ACTIVE';
    }
    this._version++;
  }

  markExpired(): void {
    this._status = 'EXPIRED';
    this._version++;
  }

  recall(): void {
    this._status = 'RECALLED';
    this._quarantineQuantity = this._quantity;
    this._version++;
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      productId: this.productId,
      batchNumber: this.batchNumber,
      manufacturingDate: this.manufacturingDate,
      expiryDate: this.expiryDate,
      quantity: this._quantity,
      quarantineQuantity: this._quarantineQuantity,
      availableQuantity: this.availableQuantity,
      status: this._status,
      mfgLotNumber: this._mfgLotNumber,
      daysUntilExpiry: this.daysUntilExpiry,
      version: this._version,
    };
  }
}
