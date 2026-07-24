import { randomUUID } from 'node:crypto';

export class CreditNoteDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CreditNoteDomainError';
  }
}

export class InvalidCreditNoteStateTransitionError extends CreditNoteDomainError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCreditNoteStateTransitionError';
  }
}

export class CreditNoteValidationError extends CreditNoteDomainError {
  constructor(public readonly fields: Record<string, string>, message = 'CreditNote validation failed') {
    const detail = Object.values(fields).join('; ');
    super(detail ? `${message}: ${detail}` : message);
    this.name = 'CreditNoteValidationError';
  }
}

export type CreditNoteStatus = 'DRAFT' | 'APPROVED' | 'APPLIED' | 'CANCELLED';

export interface DomainEvent {
  id: string;
  name: string;
  occurredAt: Date;
  payload: Record<string, any>;
}

export interface CreditNoteProps {
  id?: string;
  tenantId: string;
  distributorId: string;
  invoiceId?: string;
  creditNoteNumber: string;
  amountCents: number;
  currency?: string;
  reason: string;
  status?: CreditNoteStatus;
  idempotencyKey?: string;
  version?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class CreditNote {
  private readonly _id: string;
  private readonly _tenantId: string;
  private readonly _distributorId: string;
  private readonly _invoiceId?: string;
  private readonly _creditNoteNumber: string;
  private readonly _amountCents: number;
  private readonly _currency: string;
  private readonly _reason: string;
  private _status: CreditNoteStatus;
  private readonly _idempotencyKey?: string;
  private _version: number;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: DomainEvent[] = [];

  constructor(props: CreditNoteProps) {
    if (!props.tenantId) throw new CreditNoteDomainError('tenantId is required');
    if (!props.distributorId) throw new CreditNoteDomainError('distributorId is required');
    if (!props.creditNoteNumber || props.creditNoteNumber.trim().length === 0) {
      throw new CreditNoteDomainError('creditNoteNumber is required');
    }
    if (props.amountCents === undefined || props.amountCents <= 0) {
      throw new CreditNoteDomainError('amountCents must be > 0');
    }
    if (!props.reason || props.reason.trim().length === 0) {
      throw new CreditNoteDomainError('reason is required');
    }

    this._id = props.id || randomUUID();
    this._tenantId = props.tenantId;
    this._distributorId = props.distributorId;
    this._invoiceId = props.invoiceId;
    this._creditNoteNumber = props.creditNoteNumber;
    this._amountCents = props.amountCents;
    this._currency = props.currency || 'USD';
    this._reason = props.reason;
    this._status = props.status || 'DRAFT';
    this._idempotencyKey = props.idempotencyKey;
    this._version = props.version || 1;
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
  }

  get id(): string { return this._id; }
  get tenantId(): string { return this._tenantId; }
  get distributorId(): string { return this._distributorId; }
  get invoiceId(): string | undefined { return this._invoiceId; }
  get creditNoteNumber(): string { return this._creditNoteNumber; }
  get amountCents(): number { return this._amountCents; }
  get currency(): string { return this._currency; }
  get reason(): string { return this._reason; }
  get status(): CreditNoteStatus { return this._status; }
  get idempotencyKey(): string | undefined { return this._idempotencyKey; }
  get version(): number { return this._version; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
  get domainEvents(): DomainEvent[] { return [...this._domainEvents]; }

  public clearEvents(): void {
    this._domainEvents = [];
  }

  public approve(): void {
    this.transitionTo('APPROVED');
  }

  public apply(): void {
    this.transitionTo('APPLIED');
  }

  public cancel(): void {
    this.transitionTo('CANCELLED');
  }

  public transitionTo(newStatus: CreditNoteStatus): void {
    if (this._status === newStatus) return;

    const validTransitions: Record<CreditNoteStatus, CreditNoteStatus[]> = {
      DRAFT: ['APPROVED', 'CANCELLED'],
      APPROVED: ['APPLIED', 'CANCELLED'],
      APPLIED: [],
      CANCELLED: [],
    };

    const allowed = validTransitions[this._status] || [];
    if (!allowed.includes(newStatus)) {
      throw new InvalidCreditNoteStateTransitionError(
        `Cannot transition credit note from state '${this._status}' to '${newStatus}'`
      );
    }

    const oldStatus = this._status;
    this._status = newStatus;
    this._updatedAt = new Date();

    this._domainEvents.push({
      id: randomUUID(),
      name: `finance.credit_note.${newStatus.toLowerCase()}`,
      occurredAt: new Date(),
      payload: {
        creditNoteId: this._id,
        tenantId: this._tenantId,
        creditNoteNumber: this._creditNoteNumber,
        distributorId: this._distributorId,
        invoiceId: this._invoiceId,
        amountCents: this._amountCents,
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
      distributorId: this._distributorId,
      invoiceId: this._invoiceId,
      creditNoteNumber: this._creditNoteNumber,
      amountCents: this._amountCents,
      currency: this._currency,
      reason: this._reason,
      status: this._status,
      idempotencyKey: this._idempotencyKey,
      version: this._version,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
