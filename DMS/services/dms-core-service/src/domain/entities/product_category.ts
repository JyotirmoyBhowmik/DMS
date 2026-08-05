/**
 * ProductCategory Domain Entity.
 * Represents hierarchical product categorization with tenant scoping, versioning, and state transitions.
 */

export type ProductCategoryStatus = 'ACTIVE' | 'INACTIVE';

export interface ProductCategoryProps {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  parentCategoryId?: string;
  description?: string;
  status?: ProductCategoryStatus;
  version?: number;
}

export class ProductCategory {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly code: string;
  private _name: string;
  private _parentCategoryId?: string;
  private _description?: string;
  private _status: ProductCategoryStatus;
  private _version: number;

  public readonly domainEvents: Array<{ type: string; payload: any }> = [];

  constructor(props: ProductCategoryProps) {
    if (!props.id || !props.tenantId || !props.code || !props.name) {
      throw new Error('ProductCategory must have id, tenantId, code, and name');
    }

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.code = props.code;
    this._name = props.name;
    this._parentCategoryId = props.parentCategoryId;
    this._description = props.description;
    this._status = props.status ?? 'ACTIVE';
    this._version = props.version ?? 1;
  }

  get name(): string { return this._name; }
  get parentCategoryId(): string | undefined { return this._parentCategoryId; }
  get description(): string | undefined { return this._description; }
  get status(): ProductCategoryStatus { return this._status; }
  get version(): number { return this._version; }

  static create(props: ProductCategoryProps): ProductCategory {
    const cat = new ProductCategory(props);
    cat.domainEvents.push({
      type: 'distributor.product_category.created',
      payload: { categoryId: cat.id, code: cat.code, name: cat.name }
    });
    return cat;
  }

  updateDetails(props: Partial<Pick<ProductCategoryProps, 'name' | 'parentCategoryId' | 'description' | 'status'>>): void {
    if (props.name) this._name = props.name;
    if (props.parentCategoryId !== undefined) this._parentCategoryId = props.parentCategoryId;
    if (props.description !== undefined) this._description = props.description;
    if (props.status) this._status = props.status;

    this._version++;
    this.domainEvents.push({
      type: 'distributor.product_category.updated',
      payload: { categoryId: this.id, code: this.code, version: this._version }
    });
  }

  deactivate(): void {
    if (this._status === 'INACTIVE') return;
    this._status = 'INACTIVE';
    this._version++;
    this.domainEvents.push({
      type: 'distributor.product_category.deactivated',
      payload: { categoryId: this.id, code: this.code, version: this._version }
    });
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      code: this.code,
      name: this._name,
      parentCategoryId: this._parentCategoryId,
      description: this._description,
      status: this._status,
      version: this._version,
    };
  }
}
