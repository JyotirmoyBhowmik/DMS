import { Money } from '../value-objects/money';
import { OrderLine } from '../value-objects/order-line';

/**
 * Order domain entity.
 * Contains lines, scheme info, totals, and status transitions.
 * No ORM decorators — this is pure domain logic.
 */
export type OrderStatus = 'draft' | 'confirmed' | 'cancelled' | 'dispatched' | 'delivered';

export interface OrderProps {
  id: string;
  tenantId: string;
  agentId: string;
  outletId: string;
  distributorId: string;
  lines: OrderLine[];
  grossTotal: Money;
  totalDiscount: Money;
  netTotal: Money;
  status: OrderStatus;
  appliedSchemeIds: string[];
  notes: string;
  creditLimit: Money;
  outstandingBalance: Money;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export class Order {
  private props: OrderProps;

  private constructor(props: OrderProps) {
    this.props = { ...props, lines: [...props.lines], appliedSchemeIds: [...props.appliedSchemeIds] };
  }

  static create(input: {
    id: string;
    tenantId: string;
    agentId: string;
    outletId: string;
    distributorId: string;
    notes?: string;
    creditLimit: Money;
    outstandingBalance: Money;
  }): Order {
    const now = new Date();
    return new Order({
      ...input,
      lines: [],
      grossTotal: Money.zero(),
      totalDiscount: Money.zero(),
      netTotal: Money.zero(),
      status: 'draft',
      appliedSchemeIds: [],
      notes: input.notes ?? '',
      createdAt: now,
      updatedAt: now,
      version: 0,
    });
  }

  static reconstitute(props: OrderProps): Order {
    return new Order(props);
  }

  // ── Accessors ──────────────────────────────────────────────────
  get id(): string { return this.props.id; }
  get tenantId(): string { return this.props.tenantId; }
  get agentId(): string { return this.props.agentId; }
  get outletId(): string { return this.props.outletId; }
  get distributorId(): string { return this.props.distributorId; }
  get lines(): ReadonlyArray<OrderLine> { return this.props.lines; }
  get grossTotal(): Money { return this.props.grossTotal; }
  get totalDiscount(): Money { return this.props.totalDiscount; }
  get netTotal(): Money { return this.props.netTotal; }
  get status(): OrderStatus { return this.props.status; }
  get appliedSchemeIds(): ReadonlyArray<string> { return this.props.appliedSchemeIds; }
  get notes(): string { return this.props.notes; }
  get creditLimit(): Money { return this.props.creditLimit; }
  get outstandingBalance(): Money { return this.props.outstandingBalance; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get version(): number { return this.props.version; }

  // ── Mutations ──────────────────────────────────────────────────
  addLine(line: OrderLine): void {
    this.props.lines.push(line);
    this.recomputeTotals();
    this.props.updatedAt = new Date();
  }

  removeLine(sku: string): void {
    this.props.lines = this.props.lines.filter((l) => l.sku !== sku);
    this.recomputeTotals();
    this.props.updatedAt = new Date();
  }

  updateLineDiscount(sku: string, discountAmount: number): void {
    this.props.lines = this.props.lines.map((l) =>
      l.sku === sku ? l.withDiscount(discountAmount) : l,
    );
    this.recomputeTotals();
    this.props.updatedAt = new Date();
  }

  applyScheme(schemeId: string): void {
    if (!this.props.appliedSchemeIds.includes(schemeId)) {
      this.props.appliedSchemeIds.push(schemeId);
      this.props.updatedAt = new Date();
    }
  }

  confirm(): void {
    this.props.status = 'confirmed';
    this.props.updatedAt = new Date();
  }

  cancel(): void {
    this.props.status = 'cancelled';
    this.props.updatedAt = new Date();
  }

  markDispatched(): void {
    this.props.status = 'dispatched';
    this.props.updatedAt = new Date();
  }

  markDelivered(): void {
    this.props.status = 'delivered';
    this.props.updatedAt = new Date();
  }

  incrementVersion(): void {
    this.props.version += 1;
  }

  // ── Internal ───────────────────────────────────────────────────
  private recomputeTotals(): void {
    let gross = Money.zero();
    let discount = Money.zero();

    for (const line of this.props.lines) {
      gross = gross.add(line.unitPrice.multiply(line.qty));
      discount = discount.add(line.discount);
    }

    this.props.grossTotal = gross;
    this.props.totalDiscount = discount;
    this.props.netTotal = gross.subtract(discount);
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.props.id,
      tenantId: this.props.tenantId,
      agentId: this.props.agentId,
      outletId: this.props.outletId,
      distributorId: this.props.distributorId,
      lines: this.props.lines.map((l) => l.toJSON()),
      grossTotal: this.props.grossTotal.toJSON(),
      totalDiscount: this.props.totalDiscount.toJSON(),
      netTotal: this.props.netTotal.toJSON(),
      status: this.props.status,
      appliedSchemeIds: [...this.props.appliedSchemeIds],
      notes: this.props.notes,
      creditLimit: this.props.creditLimit.toJSON(),
      outstandingBalance: this.props.outstandingBalance.toJSON(),
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
      version: this.props.version,
    };
  }
}
