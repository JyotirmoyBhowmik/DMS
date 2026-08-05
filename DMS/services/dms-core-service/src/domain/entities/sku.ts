/**
 * SKU Domain Entity.
 * Represents a Stock Keeping Unit with barcode, EAN, unit pricing in cents, status, versioning, and state transitions.
 */

export type SkuStatus = 'ACTIVE' | 'INACTIVE';

export interface SkuProps {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  productId?: string;
  barcode?: string;
  ean?: string;
  unitPrice: number; // In cents/paise
  status?: SkuStatus;
  version?: number;
}

export class Sku {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly code: string;
  private _name: string;
  private _productId?: string;
  private _barcode?: string;
  private _ean?: string;
  private _unitPrice: number;
  private _status: SkuStatus;
  private _version: number;

  public readonly domainEvents: Array<{ type: string; payload: any }> = [];

  constructor(props: SkuProps) {
    if (!props.id || !props.tenantId || !props.code || !props.name) {
      throw new Error('SKU must have id, tenantId, code, and name');
    }
    if (props.unitPrice < 0) {
      throw new Error('SKU unitPrice must be non-negative');
    }

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.code = props.code;
    this._name = props.name;
    this._productId = props.productId;
    this._barcode = props.barcode;
    this._ean = props.ean;
    this._unitPrice = props.unitPrice;
    this._status = props.status ?? 'ACTIVE';
    this._version = props.version ?? 1;
  }

  get name(): string { return this._name; }
  get productId(): string | undefined { return this._productId; }
  get barcode(): string | undefined { return this._barcode; }
  get ean(): string | undefined { return this._ean; }
  get unitPrice(): number { return this._unitPrice; }
  get status(): SkuStatus { return this._status; }
  get version(): number { return this._version; }

  static create(props: SkuProps): Sku {
    const skuItem = new Sku(props);
    skuItem.domainEvents.push({
      type: 'distributor.sku.created',
      payload: { skuId: skuItem.id, code: skuItem.code, name: skuItem.name, unitPrice: skuItem.unitPrice }
    });
    return skuItem;
  }

  updateDetails(props: Partial<Pick<SkuProps, 'name' | 'productId' | 'barcode' | 'ean' | 'unitPrice' | 'status'>>): void {
    if (props.name) this._name = props.name;
    if (props.productId !== undefined) this._productId = props.productId;
    if (props.barcode !== undefined) this._barcode = props.barcode;
    if (props.ean !== undefined) this._ean = props.ean;
    if (props.unitPrice !== undefined) {
      if (props.unitPrice < 0) throw new Error('unitPrice cannot be negative');
      this._unitPrice = props.unitPrice;
    }
    if (props.status) this._status = props.status;

    this._version++;
    this.domainEvents.push({
      type: 'distributor.sku.updated',
      payload: { skuId: this.id, code: this.code, version: this._version }
    });
  }

  deactivate(): void {
    if (this._status === 'INACTIVE') return;
    this._status = 'INACTIVE';
    this._version++;
    this.domainEvents.push({
      type: 'distributor.sku.deactivated',
      payload: { skuId: this.id, code: this.code, version: this._version }
    });
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      code: this.code,
      name: this._name,
      productId: this._productId,
      barcode: this._barcode,
      ean: this._ean,
      unitPrice: this._unitPrice,
      status: this._status,
      version: this._version,
    };
  }
}
