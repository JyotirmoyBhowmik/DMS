import { randomUUID } from 'node:crypto';
import { DomainEvent } from './credit-note.entity.js';

export class EInvoiceDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EInvoiceDomainError';
  }
}

export class InvalidEInvoiceStateTransitionError extends EInvoiceDomainError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidEInvoiceStateTransitionError';
  }
}

export class EInvoiceValidationError extends EInvoiceDomainError {
  constructor(public readonly fields: Record<string, string>, message = 'eInvoice validation failed') {
    const detail = Object.values(fields).join('; ');
    super(detail ? `${message}: ${detail}` : message);
    this.name = 'EInvoiceValidationError';
  }
}

export type EInvoiceStatus = 'PENDING' | 'GENERATED' | 'CANCELLED' | 'FAILED';

export interface EInvoiceProps {
  id?: string;
  tenantId: string;
  invoiceId: string;
  irn: string;
  qrCode?: string;
  acknowledgementNumber?: string;
  acknowledgementDate?: Date;
  taxAmountCents?: number;
  totalAmountCents?: number;
  status?: EInvoiceStatus;
  idempotencyKey?: string;
  version?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class EInvoice {
  private readonly _id: string;
  private readonly _tenantId: string;
  private readonly _invoiceId: string;
  private readonly _irn: string;
  private readonly _qrCode?: string;
  private readonly _acknowledgementNumber?: string;
  private readonly _acknowledgementDate?: Date;
  private readonly _taxAmountCents: number;
  private readonly _totalAmountCents: number;
  private _status: EInvoiceStatus;
  private readonly _idempotencyKey?: string;
  private _version: number;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: DomainEvent[] = [];

  constructor(props: EInvoiceProps) {
    if (!props.tenantId) throw new EInvoiceDomainError('tenantId is required');
    if (!props.invoiceId) throw new EInvoiceDomainError('invoiceId is required');
    if (!props.irn || props.irn.trim().length === 0) {
      throw new EInvoiceDomainError('irn is required');
    }

    const tax = props.taxAmountCents ?? 0;
    const total = props.totalAmountCents ?? 0;

    if (tax < 0) throw new EInvoiceDomainError('taxAmountCents must be >= 0');
    if (total < 0) throw new EInvoiceDomainError('totalAmountCents must be >= 0');

    this._id = props.id || randomUUID();
    this._tenantId = props.tenantId;
    this._invoiceId = props.invoiceId;
    this._irn = props.irn;
    this._qrCode = props.qrCode;
    this._acknowledgementNumber = props.acknowledgementNumber;
    this._acknowledgementDate = props.acknowledgementDate;
    this._taxAmountCents = tax;
    this._totalAmountCents = total;
    this._status = props.status || 'PENDING';
    this._idempotencyKey = props.idempotencyKey;
    this._version = props.version || 1;
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
  }

  get id(): string { return this._id; }
  get tenantId(): string { return this._tenantId; }
  get invoiceId(): string { return this._invoiceId; }
  get irn(): string { return this._irn; }
  get qrCode(): string | undefined { return this._qrCode; }
  get acknowledgementNumber(): string | undefined { return this._acknowledgementNumber; }
  get acknowledgementDate(): Date | undefined { return this._acknowledgementDate; }
  get taxAmountCents(): number { return this._taxAmountCents; }
  get totalAmountCents(): number { return this._totalAmountCents; }
  get status(): EInvoiceStatus { return this._status; }
  get idempotencyKey(): string | undefined { return this._idempotencyKey; }
  get version(): number { return this._version; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
  get domainEvents(): DomainEvent[] { return [...this._domainEvents]; }

  public clearEvents(): void {
    this._domainEvents = [];
  }

  public markGenerated(): void {
    this.transitionTo('GENERATED');
  }

  public markCancelled(): void {
    this.transitionTo('CANCELLED');
  }

  public markFailed(): void {
    this.transitionTo('FAILED');
  }

  public transitionTo(newStatus: EInvoiceStatus): void {
    if (this._status === newStatus) return;

    const validTransitions: Record<EInvoiceStatus, EInvoiceStatus[]> = {
      PENDING: ['GENERATED', 'FAILED', 'CANCELLED'],
      GENERATED: ['CANCELLED'],
      CANCELLED: [],
      FAILED: [],
    };

    const allowed = validTransitions[this._status] || [];
    if (!allowed.includes(newStatus)) {
      throw new InvalidEInvoiceStateTransitionError(
        `Cannot transition eInvoice from state '${this._status}' to '${newStatus}'`
      );
    }

    const oldStatus = this._status;
    this._status = newStatus;
    this._updatedAt = new Date();

    this._domainEvents.push({
      id: randomUUID(),
      name: `finance.einvoice.${newStatus.toLowerCase()}`,
      occurredAt: new Date(),
      payload: {
        einvoiceId: this._id,
        tenantId: this._tenantId,
        invoiceId: this._invoiceId,
        irn: this._irn,
        taxAmountCents: this._taxAmountCents,
        totalAmountCents: this._totalAmountCents,
        oldStatus,
        newStatus,
        version: this._version,
      },
    });
  }

  public toJSON() {
    return {
      id: this._id,
      tenantId: this._tenantId,
      invoiceId: this._invoiceId,
      irn: this._irn,
      qrCode: this._qrCode,
      acknowledgementNumber: this._acknowledgementNumber,
      acknowledgementDate: this._acknowledgementDate ? this._acknowledgementDate.toISOString() : undefined,
      taxAmountCents: this._taxAmountCents,
      totalAmountCents: this._totalAmountCents,
      status: this._status,
      idempotencyKey: this._idempotencyKey,
      version: this._version,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
