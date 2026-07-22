/**
 * Inventory Domain Entity.
 * Manages SKU stocks, available/reserved balances, low-stock reorder thresholds, and state transitions.
 */

export type InventoryStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface InventoryProps {
  id: string;
  tenantId: string;
  warehouseId: string;
  skuId?: string;
  productId?: string;
  quantityAvailable?: number;
  stock?: number;
  quantityReserved?: number;
  reorderLevel?: number;
  status?: InventoryStatus;
  version?: number;
}

export class Inventory {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly warehouseId: string;
  public readonly skuId: string;
  private _quantityAvailable: number;
  private _quantityReserved: number;
  private _reorderLevel: number;
  private _status: InventoryStatus;
  private _version: number;

  public readonly domainEvents: Array<{ type: string; payload: any }> = [];

  constructor(props: InventoryProps) {
    const skuId = props.skuId || props.productId;
    const qtyAvailable = props.quantityAvailable ?? props.stock ?? 0;
    if (!props.id || !props.tenantId || !props.warehouseId || !skuId) {
      throw new Error('Inventory must have id, tenantId, warehouseId, and skuId');
    }
    if (qtyAvailable < 0) {
      throw new Error('quantityAvailable cannot be negative');
    }
    const reserved = props.quantityReserved ?? 0;
    if (reserved < 0) {
      throw new Error('quantityReserved cannot be negative');
    }

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.warehouseId = props.warehouseId;
    this.skuId = skuId;
    this._quantityAvailable = qtyAvailable;

    this._quantityReserved = reserved;
    this._reorderLevel = props.reorderLevel ?? 10;
    this._status = props.status ?? this.calculateStatus(this._quantityAvailable, this._reorderLevel);
    this._version = props.version ?? 1;
  }

  get stock(): number { return this._quantityAvailable; } // Backward compatibility
  get productId(): string { return this.skuId; } // Backward compatibility
  get quantityAvailable(): number { return this._quantityAvailable; }
  get quantityReserved(): number { return this._quantityReserved; }
  get reorderLevel(): number { return this._reorderLevel; }
  get status(): InventoryStatus { return this._status; }
  get version(): number { return this._version; }

  private calculateStatus(available: number, reorder: number): InventoryStatus {
    if (available === 0) return 'OUT_OF_STOCK';
    if (available <= reorder) return 'LOW_STOCK';
    return 'IN_STOCK';
  }

  static create(props: InventoryProps): Inventory {
    const inv = new Inventory(props);
    inv.domainEvents.push({
      type: 'distributor.inventory.adjusted',
      payload: { inventoryId: inv.id, warehouseId: inv.warehouseId, skuId: inv.skuId, available: inv.quantityAvailable }
    });
    return inv;
  }

  adjustStock(delta: number): void {
    const newQty = this._quantityAvailable + delta;
    if (newQty < 0) {
      throw new Error(`Insufficient stock. Available: ${this._quantityAvailable}, Requested delta: ${delta}`);
    }
    this._quantityAvailable = newQty;
    this._status = this.calculateStatus(this._quantityAvailable, this._reorderLevel);
    this._version++;

    this.domainEvents.push({
      type: 'distributor.inventory.adjusted',
      payload: { inventoryId: this.id, available: this._quantityAvailable, status: this._status, version: this._version }
    });
  }

  replenish(quantity: number): void {
    if (quantity <= 0) throw new Error('Replenish quantity must be positive');
    this.adjustStock(quantity);
  }

  deduct(quantity: number): void {
    if (quantity <= 0) throw new Error('Deduction quantity must be positive');
    this.adjustStock(-quantity);
  }

  reserveStock(quantity: number): void {
    if (quantity <= 0) throw new Error('Reserve quantity must be positive');
    if (this._quantityAvailable < quantity) {
      throw new Error(`Cannot reserve ${quantity} units, only ${this._quantityAvailable} available`);
    }
    this._quantityAvailable -= quantity;
    this._quantityReserved += quantity;
    this._status = this.calculateStatus(this._quantityAvailable, this._reorderLevel);
    this._version++;

    this.domainEvents.push({
      type: 'distributor.inventory.reserved',
      payload: { inventoryId: this.id, reserved: quantity, remainingAvailable: this._quantityAvailable, version: this._version }
    });
  }

  isBelowSafetyThreshold(minThreshold: number): boolean {
    return this._quantityAvailable < minThreshold;
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      warehouseId: this.warehouseId,
      skuId: this.skuId,
      productId: this.skuId,
      stock: this._quantityAvailable,
      quantityAvailable: this._quantityAvailable,
      quantityReserved: this._quantityReserved,
      reorderLevel: this._reorderLevel,
      status: this._status,
      version: this._version,
    };
  }
}
