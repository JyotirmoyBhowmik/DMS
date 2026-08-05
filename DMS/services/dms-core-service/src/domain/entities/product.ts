/**
 * Product/SKU Domain Entity.
 * Manages product attributes, pricing in cents, inventory safety thresholds, and state transitions.
 */

export type ProductStatus = 'ACTIVE' | 'DISCONTINUED';

export interface ProductProps {
  id: string;
  tenantId: string;
  sku: string;
  name: string;
  category: string;
  price: number; // In cents/paise
  minThreshold: number;
  uom?: string;
  status?: ProductStatus;
  version?: number;
}

export class Product {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly sku: string;
  private _name: string;
  private _category: string;
  private _price: number;
  private _minThreshold: number;
  private _uom: string;
  private _status: ProductStatus;
  private _version: number;

  public readonly domainEvents: Array<{ type: string; payload: any }> = [];

  constructor(props: ProductProps) {
    if (!props.id || !props.tenantId || !props.sku || !props.name) {
      throw new Error('Product must have id, tenantId, sku, and name');
    }
    if (props.price < 0) {
      throw new Error('Product price must be non-negative');
    }
    if (props.minThreshold < 0) {
      throw new Error('Product minThreshold must be non-negative');
    }

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.sku = props.sku;
    this._name = props.name;
    this._category = props.category;
    this._price = props.price;
    this._minThreshold = props.minThreshold;
    this._uom = props.uom ?? 'UNIT';
    this._status = props.status ?? 'ACTIVE';
    this._version = props.version ?? 1;
  }

  get name(): string { return this._name; }
  get category(): string { return this._category; }
  get price(): number { return this._price; }
  get minThreshold(): number { return this._minThreshold; }
  get uom(): string { return this._uom; }
  get status(): ProductStatus { return this._status; }
  get version(): number { return this._version; }

  static create(props: ProductProps): Product {
    const product = new Product(props);
    product.domainEvents.push({
      type: 'distributor.product.created',
      payload: { productId: product.id, sku: product.sku, name: product.name, price: product.price }
    });
    return product;
  }

  updateDetails(props: Partial<Pick<ProductProps, 'name' | 'category' | 'price' | 'minThreshold' | 'uom' | 'status'>>): void {
    if (props.name) this._name = props.name;
    if (props.category) this._category = props.category;
    if (props.price !== undefined) {
      if (props.price < 0) throw new Error('Price cannot be negative');
      this._price = props.price;
    }
    if (props.minThreshold !== undefined) {
      if (props.minThreshold < 0) throw new Error('minThreshold cannot be negative');
      this._minThreshold = props.minThreshold;
    }
    if (props.uom) this._uom = props.uom;
    if (props.status) this._status = props.status;

    this._version++;
    this.domainEvents.push({
      type: 'distributor.product.updated',
      payload: { productId: this.id, sku: this.sku, version: this._version }
    });
  }

  discontinue(): void {
    if (this._status === 'DISCONTINUED') return;
    this._status = 'DISCONTINUED';
    this._version++;
    this.domainEvents.push({
      type: 'distributor.product.discontinued',
      payload: { productId: this.id, sku: this.sku, version: this._version }
    });
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      sku: this.sku,
      name: this._name,
      category: this._category,
      price: this._price,
      minThreshold: this._minThreshold,
      uom: this._uom,
      status: this._status,
      version: this._version,
    };
  }
}
