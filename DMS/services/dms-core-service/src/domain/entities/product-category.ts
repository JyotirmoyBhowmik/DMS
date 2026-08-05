/**
 * ProductCategory Domain Entity.
 * Hierarchical product categorization, max 4 levels deep.
 */

export interface ProductCategoryProps {
  id: string;
  tenantId: string;
  name: string;
  parentCategoryId?: string;
  level?: number;
  sortOrder?: number;
  isActive?: boolean;
  iconUrl?: string;
  description?: string;
  version?: number;
}

const MAX_CATEGORY_DEPTH = 4;

export class ProductCategory {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly name: string;
  public readonly parentCategoryId?: string;
  public readonly level: number;
  private _sortOrder: number;
  private _isActive: boolean;
  private _iconUrl?: string;
  private _description?: string;
  private _version: number;

  constructor(props: ProductCategoryProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.parentCategoryId = props.parentCategoryId;
    this.level = props.level ?? 1;
    this._sortOrder = props.sortOrder ?? 0;
    this._isActive = props.isActive ?? true;
    this._iconUrl = props.iconUrl;
    this._description = props.description;
    this._version = props.version ?? 1;
  }

  get sortOrder(): number { return this._sortOrder; }
  get isActive(): boolean { return this._isActive; }
  get iconUrl(): string | undefined { return this._iconUrl; }
  get description(): string | undefined { return this._description; }
  get version(): number { return this._version; }

  static create(props: ProductCategoryProps): ProductCategory {
    if (!props.name.trim()) {
      throw new Error('Category name is required');
    }
    const level = props.level ?? 1;
    if (level < 1 || level > MAX_CATEGORY_DEPTH) {
      throw new Error(`Category level must be between 1 and ${MAX_CATEGORY_DEPTH}`);
    }
    return new ProductCategory(props);
  }

  /**
   * Validates that category level matches the expected depth.
   * parentLevel + 1 must equal this category's level.
   */
  static validateLevel(parentLevel: number, childLevel: number): void {
    if (childLevel !== parentLevel + 1) {
      throw new Error(`Child level ${childLevel} must be exactly parent level ${parentLevel} + 1`);
    }
    if (childLevel > MAX_CATEGORY_DEPTH) {
      throw new Error(`Maximum category depth of ${MAX_CATEGORY_DEPTH} exceeded`);
    }
  }

  deactivate(): void {
    this._isActive = false;
    this._version++;
  }

  activate(): void {
    this._isActive = true;
    this._version++;
  }

  updateSortOrder(order: number): void {
    this._sortOrder = order;
    this._version++;
  }

  updateDetails(details: { iconUrl?: string; description?: string }): void {
    if (details.iconUrl !== undefined) this._iconUrl = details.iconUrl;
    if (details.description !== undefined) this._description = details.description;
    this._version++;
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      name: this.name,
      parentCategoryId: this.parentCategoryId,
      level: this.level,
      sortOrder: this._sortOrder,
      isActive: this._isActive,
      iconUrl: this._iconUrl,
      description: this._description,
      version: this._version,
    };
  }
}
