import { randomUUID } from 'node:crypto';

export class InvoiceDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvoiceDomainError';
  }
}

export class InvalidInvoiceStateTransitionError extends InvoiceDomainError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidInvoiceStateTransitionError';
  }
}

export class InvoiceValidationError extends InvoiceDomainError {
  constructor(public readonly fields: Record<string, string>, message = 'Invoice validation failed') {
    super(message);
    this.name = 'InvoiceValidationError';
  }
}

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'CANCELLED' | 'CREDIT_NOTE';

export interface InvoiceItemProps {
  id?: string;
  tenantId: string;
  invoiceId?: string;
  productId: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalAmountCents?: number;
}

export class InvoiceItem {
  private readonly _id: string;
  private readonly _tenantId: string;
  private _invoiceId?: string;
  private readonly _productId: string;
  private readonly _description: string;
  private readonly _quantity: number;
  private readonly _unitPriceCents: number;
  private readonly _totalAmountCents: number;

  constructor(props: InvoiceItemProps) {
    if (!props.tenantId) throw new InvoiceDomainError('Item tenantId is required');
    if (!props.productId) throw new InvoiceDomainError('Item productId is required');
    if (!props.description || props.description.trim().length === 0) {
      throw new InvoiceDomainError('Item description is required');
    }
    if (props.quantity === undefined || props.quantity <= 0) {
      throw new InvoiceDomainError('Item quantity must be > 0');
    }
    if (props.unitPriceCents === undefined || props.unitPriceCents < 0) {
      throw new InvoiceDomainError('Item unitPriceCents must be >= 0');
    }

    this._id = props.id || randomUUID();
    this._tenantId = props.tenantId;
    this._invoiceId = props.invoiceId;
    this._productId = props.productId;
    this._description = props.description;
    this._quantity = props.quantity;
    this._unitPriceCents = props.unitPriceCents;
    this._totalAmountCents = props.totalAmountCents !== undefined ? props.totalAmountCents : props.quantity * props.unitPriceCents;
  }

  get id(): string { return this._id; }
  get tenantId(): string { return this._tenantId; }
  get invoiceId(): string | undefined { return this._invoiceId; }
  get productId(): string { return this._productId; }
  get description(): string { return this._description; }
  get quantity(): number { return this._quantity; }
  get unitPriceCents(): number { return this._unitPriceCents; }
  get totalAmountCents(): number { return this._totalAmountCents; }

  setInvoiceId(invoiceId: string): void {
    this._invoiceId = invoiceId;
  }

  toJSON() {
    return {
      id: this._id,
      tenantId: this._tenantId,
      invoiceId: this._invoiceId,
      productId: this._productId,
      description: this._description,
      quantity: this._quantity,
      unitPriceCents: this._unitPriceCents,
      totalAmountCents: this._totalAmountCents,
    };
  }
}

export interface DomainEvent {
  id: string;
  name: string;
  occurredAt: Date;
  payload: Record<string, any>;
}

export interface InvoiceProps {
  id?: string;
  tenantId: string;
  distributorId: string;
  orderId?: string;
  invoiceNumber: string;
  grossAmountCents?: number;
  discountAmountCents?: number;
  taxAmountCents?: number;
  netAmountCents?: number;
  currency?: string;
  status?: InvoiceStatus;
  dueDate: Date | string;
  paidAt?: Date | string;
  idempotencyKey?: string;
  items?: InvoiceItem[];
  version?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Invoice {
  private readonly _id: string;
  private readonly _tenantId: string;
  private readonly _distributorId: string;
  private readonly _orderId?: string;
  private readonly _invoiceNumber: string;
  private _grossAmountCents: number;
  private _discountAmountCents: number;
  private _taxAmountCents: number;
  private _netAmountCents: number;
  private readonly _currency: string;
  private _status: InvoiceStatus;
  private readonly _dueDate: Date;
  private _paidAt?: Date;
  private readonly _idempotencyKey?: string;
  private _items: InvoiceItem[] = [];
  private _version: number;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: DomainEvent[] = [];

  constructor(props: InvoiceProps) {
    if (!props.tenantId) throw new InvoiceDomainError('tenantId is required');
    if (!props.distributorId) throw new InvoiceDomainError('distributorId is required');
    if (!props.invoiceNumber || props.invoiceNumber.trim().length === 0) {
      throw new InvoiceDomainError('invoiceNumber is required');
    }
    if (!props.dueDate) throw new InvoiceDomainError('dueDate is required');

    this._id = props.id || randomUUID();
    this._tenantId = props.tenantId;
    this._distributorId = props.distributorId;
    this._orderId = props.orderId;
    this._invoiceNumber = props.invoiceNumber;
    this._currency = props.currency || 'USD';
    this._status = props.status || 'DRAFT';
    this._dueDate = typeof props.dueDate === 'string' ? new Date(props.dueDate) : props.dueDate;
    this._paidAt = props.paidAt ? (typeof props.paidAt === 'string' ? new Date(props.paidAt) : props.paidAt) : undefined;
    this._idempotencyKey = props.idempotencyKey;
    this._version = props.version || 1;
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();

    this._grossAmountCents = props.grossAmountCents || 0;
    this._discountAmountCents = props.discountAmountCents || 0;
    this._taxAmountCents = props.taxAmountCents || 0;
    this._netAmountCents = props.netAmountCents !== undefined ? props.netAmountCents : (this._grossAmountCents - this._discountAmountCents + this._taxAmountCents);

    if (props.items && props.items.length > 0) {
      props.items.forEach(item => this.addItem(item));
    }

    if (this._grossAmountCents < 0 || this._discountAmountCents < 0 || this._taxAmountCents < 0 || this._netAmountCents < 0) {
      throw new InvoiceDomainError('Monetary amounts cannot be negative');
    }

  }

  get id(): string { return this._id; }
  get tenantId(): string { return this._tenantId; }
  get distributorId(): string { return this._distributorId; }
  get orderId(): string | undefined { return this._orderId; }
  get invoiceNumber(): string { return this._invoiceNumber; }
  get grossAmountCents(): number { return this._grossAmountCents; }
  get discountAmountCents(): number { return this._discountAmountCents; }
  get taxAmountCents(): number { return this._taxAmountCents; }
  get netAmountCents(): number { return this._netAmountCents; }
  get currency(): string { return this._currency; }
  get status(): InvoiceStatus { return this._status; }
  get dueDate(): Date { return this._dueDate; }
  get paidAt(): Date | undefined { return this._paidAt; }
  get idempotencyKey(): string | undefined { return this._idempotencyKey; }
  get items(): InvoiceItem[] { return [...this._items]; }
  get version(): number { return this._version; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
  get domainEvents(): DomainEvent[] { return [...this._domainEvents]; }

  public clearEvents(): void {
    this._domainEvents = [];
  }

  public addItem(item: InvoiceItem): void {
    item.setInvoiceId(this._id);
    this._items.push(item);
    this.recalculateTotals();
  }

  public recalculateTotals(): void {
    this._grossAmountCents = this._items.reduce((sum, item) => sum + item.totalAmountCents, 0);
    this._netAmountCents = this._grossAmountCents - this._discountAmountCents + this._taxAmountCents;
    if (this._netAmountCents < 0) this._netAmountCents = 0;
  }

  public issue(): void {
    this.transitionTo('ISSUED');
  }

  public pay(paidAt = new Date()): void {
    this.transitionTo('PAID');
    this._paidAt = paidAt;
  }

  public cancel(): void {
    this.transitionTo('CANCELLED');
  }

  public addCreditNote(): void {
    this.transitionTo('CREDIT_NOTE');
  }

  public transitionTo(newStatus: InvoiceStatus): void {
    if (this._status === newStatus) return;

    const validTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
      DRAFT: ['ISSUED', 'CANCELLED'],
      ISSUED: ['PAID', 'CANCELLED', 'CREDIT_NOTE'],
      PAID: ['CREDIT_NOTE'],
      CANCELLED: [],
      CREDIT_NOTE: [],
    };

    const allowed = validTransitions[this._status] || [];
    if (!allowed.includes(newStatus)) {
      throw new InvalidInvoiceStateTransitionError(
        `Cannot transition invoice from state '${this._status}' to '${newStatus}'`
      );
    }

    const oldStatus = this._status;
    this._status = newStatus;
    this._updatedAt = new Date();

    this._domainEvents.push({
      id: randomUUID(),
      name: `finance.invoice.${newStatus.toLowerCase()}`,
      occurredAt: new Date(),
      payload: {
        invoiceId: this._id,
        tenantId: this._tenantId,
        invoiceNumber: this._invoiceNumber,
        distributorId: this._distributorId,
        oldStatus,
        newStatus,
        netAmountCents: this._netAmountCents,
        version: this._version,
      },
    });
  }

  public toJSON() {
    return {
      id: this._id,
      tenantId: this._tenantId,
      distributorId: this._distributorId,
      orderId: this._orderId,
      invoiceNumber: this._invoiceNumber,
      grossAmountCents: this._grossAmountCents,
      discountAmountCents: this._discountAmountCents,
      taxAmountCents: this._taxAmountCents,
      netAmountCents: this._netAmountCents,
      currency: this._currency,
      status: this._status,
      dueDate: this._dueDate.toISOString(),
      paidAt: this._paidAt ? this._paidAt.toISOString() : null,
      idempotencyKey: this._idempotencyKey,
      items: this._items.map(item => item.toJSON()),
      version: this._version,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
