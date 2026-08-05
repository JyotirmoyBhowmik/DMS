/**
 * PriceList Domain Entity.
 * Named price lists with date-range validity and per-product pricing.
 * All monetary values in BIGINT (paise/cents).
 */

export interface PriceListEntry {
  id?: string;
  productId: string;
  basePrice: number;
  mrp: number;
}

export interface PriceListProps {
  id: string;
  tenantId: string;
  name: string;
  effectiveFrom: string; // ISO-8601 date
  effectiveTo?: string;
  entries?: PriceListEntry[];
  isActive?: boolean;
  version?: number;
}

export class PriceList {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly name: string;
  public readonly effectiveFrom: string;
  private _effectiveTo?: string;
  private _entries: PriceListEntry[];
  private _isActive: boolean;
  private _version: number;

  constructor(props: PriceListProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.effectiveFrom = props.effectiveFrom;
    this._effectiveTo = props.effectiveTo;
    this._entries = [...(props.entries ?? [])];
    this._isActive = props.isActive ?? true;
    this._version = props.version ?? 1;
  }

  get effectiveTo(): string | undefined { return this._effectiveTo; }
  get entries(): PriceListEntry[] { return [...this._entries]; }
  get isActive(): boolean { return this._isActive; }
  get version(): number { return this._version; }

  static create(props: PriceListProps): PriceList {
    if (!props.name.trim()) {
      throw new Error('Price list name is required');
    }
    if (props.effectiveTo && new Date(props.effectiveTo) <= new Date(props.effectiveFrom)) {
      throw new Error('effectiveTo must be after effectiveFrom');
    }
    // Validate entries
    for (const entry of (props.entries ?? [])) {
      if (entry.mrp < entry.basePrice) {
        throw new Error(`MRP (${entry.mrp}) must be >= base price (${entry.basePrice}) for product ${entry.productId}`);
      }
    }
    return new PriceList(props);
  }

  /**
   * Whether this price list is currently effective.
   */
  isEffective(asOfDate?: Date): boolean {
    const now = asOfDate ?? new Date();
    const from = new Date(this.effectiveFrom);
    if (now < from) return false;
    if (this._effectiveTo && now > new Date(this._effectiveTo)) return false;
    return this._isActive;
  }

  addEntry(entry: PriceListEntry): void {
    if (entry.mrp < entry.basePrice) {
      throw new Error(`MRP (${entry.mrp}) must be >= base price (${entry.basePrice})`);
    }
    const existing = this._entries.findIndex(e => e.productId === entry.productId);
    if (existing >= 0) {
      this._entries[existing] = entry;
    } else {
      this._entries.push(entry);
    }
    this._version++;
  }

  removeEntry(productId: string): void {
    this._entries = this._entries.filter(e => e.productId !== productId);
    this._version++;
  }

  getEntryForProduct(productId: string): PriceListEntry | undefined {
    return this._entries.find(e => e.productId === productId);
  }

  deactivate(): void {
    this._isActive = false;
    this._effectiveTo = new Date().toISOString().split('T')[0];
    this._version++;
  }

  activate(): void {
    this._isActive = true;
    this._version++;
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      name: this.name,
      effectiveFrom: this.effectiveFrom,
      effectiveTo: this._effectiveTo,
      entries: this._entries,
      isActive: this._isActive,
      version: this._version,
    };
  }
}
