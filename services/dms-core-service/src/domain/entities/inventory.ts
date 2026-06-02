/**
 * Inventory Domain Entity.
 * Manages SKU stocks in specific warehouses.
 */
export class Inventory {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly productId: string;
  public readonly warehouseId: string;
  private _stock: number;

  constructor(id: string, tenantId: string, productId: string, warehouseId: string, stock: number) {
    this.id = id;
    this.tenantId = tenantId;
    this.productId = productId;
    this.warehouseId = warehouseId;
    this._stock = stock;
  }

  get stock(): number {
    return this._stock;
  }

  static create(props: {
    id: string;
    tenantId: string;
    productId: string;
    warehouseId: string;
    stock: number;
  }): Inventory {
    return new Inventory(props.id, props.tenantId, props.productId, props.warehouseId, props.stock);
  }

  replenish(quantity: number): void {
    if (quantity <= 0) throw new Error('Replenish quantity must be positive');
    this._stock += quantity;
  }

  deduct(quantity: number): void {
    if (quantity <= 0) throw new Error('Deduction quantity must be positive');
    if (this._stock < quantity) {
      throw new Error(`Insufficient stock. Available: ${this._stock}, Requested: ${quantity}`);
    }
    this._stock -= quantity;
  }

  isBelowSafetyThreshold(minThreshold: number): boolean {
    return this._stock < minThreshold;
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      productId: this.productId,
      warehouseId: this.warehouseId,
      stock: this._stock,
    };
  }
}
