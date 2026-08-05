import { Money } from '../value-objects/money';

/**
 * VanSale domain entity.
 * Tracks mobile van selling: loading, in-transit, selling, reconciliation, close.
 * Business rules: sold + returned <= loaded per SKU, cash reconciliation must match.
 */
export type VanSaleStatus = 'loading' | 'in_transit' | 'selling' | 'reconciliation' | 'closed';

export interface LoadedItem {
  skuId: string;
  qty: number;
  batchNumber: string;
}

export interface SoldItem {
  skuId: string;
  qty: number;
  unitPrice: number; // smallest currency unit
  outletId: string;
}

export interface ReturnedItem {
  skuId: string;
  qty: number;
  reason: string;
}

export interface VanSaleProps {
  id: string;
  tenantId: string;
  agentId: string;
  vehicleId: string;
  routeId: string;
  date: string; // ISO date YYYY-MM-DD
  loadedItems: LoadedItem[];
  soldItems: SoldItem[];
  returnedItems: ReturnedItem[];
  cashCollected: Money;
  digitalPayments: Money;
  status: VanSaleStatus;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export class VanSale {
  private props: VanSaleProps;

  private constructor(props: VanSaleProps) {
    this.props = {
      ...props,
      loadedItems: props.loadedItems.map((i) => ({ ...i })),
      soldItems: props.soldItems.map((i) => ({ ...i })),
      returnedItems: props.returnedItems.map((i) => ({ ...i })),
    };
  }

  static create(input: {
    id: string;
    tenantId: string;
    agentId: string;
    vehicleId: string;
    routeId: string;
    date: string;
    loadedItems?: LoadedItem[];
  }): VanSale {
    const now = new Date();
    return new VanSale({
      ...input,
      loadedItems: input.loadedItems?.map((i) => ({ ...i })) ?? [],
      soldItems: [],
      returnedItems: [],
      cashCollected: Money.zero(),
      digitalPayments: Money.zero(),
      status: 'loading',
      createdAt: now,
      updatedAt: now,
      version: 0,
    });
  }

  static reconstitute(props: VanSaleProps): VanSale {
    return new VanSale(props);
  }

  // ── Accessors ──────────────────────────────────────────────────
  get id(): string { return this.props.id; }
  get tenantId(): string { return this.props.tenantId; }
  get agentId(): string { return this.props.agentId; }
  get vehicleId(): string { return this.props.vehicleId; }
  get routeId(): string { return this.props.routeId; }
  get date(): string { return this.props.date; }
  get loadedItems(): ReadonlyArray<LoadedItem> { return this.props.loadedItems; }
  get soldItems(): ReadonlyArray<SoldItem> { return this.props.soldItems; }
  get returnedItems(): ReadonlyArray<ReturnedItem> { return this.props.returnedItems; }
  get cashCollected(): Money { return this.props.cashCollected; }
  get digitalPayments(): Money { return this.props.digitalPayments; }
  get status(): VanSaleStatus { return this.props.status; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get version(): number { return this.props.version; }

  // ── State Transitions ─────────────────────────────────────────
  startTransit(): void {
    if (this.props.status !== 'loading') {
      throw new Error(`Cannot start transit from state: ${this.props.status}`);
    }
    if (this.props.loadedItems.length === 0) {
      throw new Error('Cannot start transit with no loaded items');
    }
    this.props.status = 'in_transit';
    this.props.updatedAt = new Date();
  }

  startSelling(): void {
    if (this.props.status !== 'in_transit') {
      throw new Error(`Cannot start selling from state: ${this.props.status}`);
    }
    this.props.status = 'selling';
    this.props.updatedAt = new Date();
  }

  startReconciliation(): void {
    if (this.props.status !== 'selling') {
      throw new Error(`Cannot start reconciliation from state: ${this.props.status}`);
    }
    this.props.status = 'reconciliation';
    this.props.updatedAt = new Date();
  }

  close(): void {
    if (this.props.status !== 'reconciliation') {
      throw new Error(`Cannot close van sale from state: ${this.props.status}`);
    }
    this.validateReconciliation();
    this.props.status = 'closed';
    this.props.updatedAt = new Date();
  }

  // ── Mutations ──────────────────────────────────────────────────
  addLoadedItem(item: LoadedItem): void {
    if (this.props.status !== 'loading') {
      throw new Error('Can only add loaded items during loading phase');
    }
    this.props.loadedItems.push({ ...item });
    this.props.updatedAt = new Date();
  }

  recordSale(item: SoldItem): void {
    if (this.props.status !== 'selling') {
      throw new Error('Can only record sales during selling phase');
    }
    this.validateSkuQuantity(item.skuId, item.qty, 'sold');
    this.props.soldItems.push({ ...item });
    this.props.updatedAt = new Date();
  }

  recordReturn(item: ReturnedItem): void {
    if (this.props.status !== 'selling' && this.props.status !== 'reconciliation') {
      throw new Error('Can only record returns during selling or reconciliation phase');
    }
    this.validateSkuQuantity(item.skuId, item.qty, 'returned');
    this.props.returnedItems.push({ ...item });
    this.props.updatedAt = new Date();
  }

  collectCash(amount: Money): void {
    this.props.cashCollected = this.props.cashCollected.add(amount);
    this.props.updatedAt = new Date();
  }

  collectDigitalPayment(amount: Money): void {
    this.props.digitalPayments = this.props.digitalPayments.add(amount);
    this.props.updatedAt = new Date();
  }

  incrementVersion(): void {
    this.props.version += 1;
  }

  // ── Validation ─────────────────────────────────────────────────
  /** Business rule: sold + returned <= loaded per SKU */
  private validateSkuQuantity(skuId: string, additionalQty: number, type: 'sold' | 'returned'): void {
    const loadedQty = this.props.loadedItems
      .filter((i) => i.skuId === skuId)
      .reduce((sum, i) => sum + i.qty, 0);

    const soldQty = this.props.soldItems
      .filter((i) => i.skuId === skuId)
      .reduce((sum, i) => sum + i.qty, 0);

    const returnedQty = this.props.returnedItems
      .filter((i) => i.skuId === skuId)
      .reduce((sum, i) => sum + i.qty, 0);

    const pending = type === 'sold' ? soldQty + additionalQty + returnedQty : soldQty + returnedQty + additionalQty;

    if (pending > loadedQty) {
      throw new Error(
        `Cannot ${type} ${additionalQty} of SKU ${skuId}: sold(${soldQty}) + returned(${returnedQty}) + ${additionalQty} > loaded(${loadedQty})`,
      );
    }
  }

  /** Ensure sold + returned totals do not exceed loaded for any SKU */
  private validateReconciliation(): void {
    const skuIds = new Set(this.props.loadedItems.map((i) => i.skuId));
    for (const skuId of skuIds) {
      const loaded = this.props.loadedItems
        .filter((i) => i.skuId === skuId)
        .reduce((sum, i) => sum + i.qty, 0);
      const sold = this.props.soldItems
        .filter((i) => i.skuId === skuId)
        .reduce((sum, i) => sum + i.qty, 0);
      const returned = this.props.returnedItems
        .filter((i) => i.skuId === skuId)
        .reduce((sum, i) => sum + i.qty, 0);
      if (sold + returned > loaded) {
        throw new Error(
          `Reconciliation failed for SKU ${skuId}: sold(${sold}) + returned(${returned}) > loaded(${loaded})`,
        );
      }
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.props.id,
      tenantId: this.props.tenantId,
      agentId: this.props.agentId,
      vehicleId: this.props.vehicleId,
      routeId: this.props.routeId,
      date: this.props.date,
      loadedItems: this.props.loadedItems.map((i) => ({ ...i })),
      soldItems: this.props.soldItems.map((i) => ({ ...i })),
      returnedItems: this.props.returnedItems.map((i) => ({ ...i })),
      cashCollected: this.props.cashCollected.toJSON(),
      digitalPayments: this.props.digitalPayments.toJSON(),
      status: this.props.status,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
      version: this.props.version,
    };
  }
}
