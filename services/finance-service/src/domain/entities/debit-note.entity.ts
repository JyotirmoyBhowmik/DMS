import { randomUUID } from 'node:crypto';
import { DomainEvent } from './credit-note.entity.js';

export class DebitNoteDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DebitNoteDomainError';
  }
}

export class InvalidDebitNoteStateTransitionError extends DebitNoteDomainError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidDebitNoteStateTransitionError';
  }
}

export class DebitNoteValidationError extends DebitNoteDomainError {
  constructor(public readonly fields: Record<string, string>, message = 'DebitNote validation failed') {
    const detail = Object.values(fields).join('; ');
    super(detail ? `${message}: ${detail}` : message);
    this.name = 'DebitNoteValidationError';
  }
}

export type DebitNoteStatus = 'DRAFT' | 'APPROVED' | 'APPLIED' | 'CANCELLED';

export interface DebitNoteProps {
  id?: string;
  tenantId: string;
  distributorId: string;
  invoiceId?: string;
  debitNoteNumber: string;
  amountCents: number;
  currency?: string;
  reason: string;
  status?: DebitNoteStatus;
  idempotencyKey?: string;
  version?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class DebitNote {
  private readonly _id: string;
  private readonly _tenantId: string;
  private readonly _distributorId: string;
  private readonly _invoiceId?: string;
  private readonly _debitNoteNumber: string;
  private readonly _amountCents: number;
  private readonly _currency: string;
  private readonly _reason: string;
  private _status: DebitNoteStatus;
  private readonly _idempotencyKey?: string;
  private _version: number;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: DomainEvent[] = [];

  constructor(props: DebitNoteProps) {
    if (!props.tenantId) throw new DebitNoteDomainError('tenantId is required');
    if (!props.distributorId) throw new DebitNoteDomainError('distributorId is required');
    if (!props.debitNoteNumber || props.debitNoteNumber.trim().length === 0) {
      throw new DebitNoteDomainError('debitNoteNumber is required');
    }
    if (props.amountCents === undefined || props.amountCents <= 0) {
      throw new DebitNoteDomainError('amountCents must be > 0');
    }
    if (!props.reason || props.reason.trim().length === 0) {
      throw new DebitNoteDomainError('reason is required');
    }

    this._id = props.id || randomUUID();
    this._tenantId = props.tenantId;
    this._distributorId = props.distributorId;
    this._invoiceId = props.invoiceId;
    this._debitNoteNumber = props.debitNoteNumber;
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
  get debitNoteNumber(): string { return this._debitNoteNumber; }
  get amountCents(): number { return this._amountCents; }
  get currency(): string { return this._currency; }
  get reason(): string { return this._reason; }
  get status(): DebitNoteStatus { return this._status; }
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

  public transitionTo(newStatus: DebitNoteStatus): void {
    if (this._status === newStatus) return;

    const validTransitions: Record<DebitNoteStatus, DebitNoteStatus[]> = {
      DRAFT: ['APPROVED', 'CANCELLED'],
      APPROVED: ['APPLIED', 'CANCELLED'],
      APPLIED: [],
      CANCELLED: [],
    };

    const allowed = validTransitions[this._status] || [];
    if (!allowed.includes(newStatus)) {
      throw new InvalidDebitNoteStateTransitionError(
        `Cannot transition debit note from state '${this._status}' to '${newStatus}'`
      );
    }

    const oldStatus = this._status;
    this._status = newStatus;
    this._updatedAt = new Date();

    this._domainEvents.push({
      id: randomUUID(),
      name: `finance.debit_note.${newStatus.toLowerCase()}`,
      occurredAt: new Date(),
      payload: {
        debitNoteId: this._id,
        tenantId: this._tenantId,
        debitNoteNumber: this._debitNoteNumber,
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
      debitNoteNumber: this._debitNoteNumber,
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
