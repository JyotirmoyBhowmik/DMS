import { randomUUID } from 'node:crypto';
import { DomainEvent } from './credit-note.entity.js';

export class OutstandingDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OutstandingDomainError';
  }
}

export class InvalidOutstandingStateTransitionError extends OutstandingDomainError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidOutstandingStateTransitionError';
  }
}

export class OutstandingValidationError extends OutstandingDomainError {
  constructor(public readonly fields: Record<string, string>, message = 'Outstanding validation failed') {
    const detail = Object.values(fields).join('; ');
    super(detail ? `${message}: ${detail}` : message);
    this.name = 'OutstandingValidationError';
  }
}

export type OutstandingStatus = 'OPEN' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'WRITTEN_OFF';

export interface OutstandingProps {
  id?: string;
  tenantId: string;
  distributorId: string;
  invoiceId?: string;
  outstandingReference: string;
  amountCents: number;
  dueDate?: Date;
  status?: OutstandingStatus;
  idempotencyKey?: string;
  version?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Outstanding {
  private readonly _id: string;
  private readonly _tenantId: string;
  private readonly _distributorId: string;
  private readonly _invoiceId?: string;
  private readonly _outstandingReference: string;
  private readonly _amountCents: number;
  private readonly _dueDate?: Date;
  private _status: OutstandingStatus;
  private readonly _idempotencyKey?: string;
  private _version: number;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: DomainEvent[] = [];

  constructor(props: OutstandingProps) {
    if (!props.tenantId) throw new OutstandingDomainError('tenantId is required');
    if (!props.distributorId) throw new OutstandingDomainError('distributorId is required');
    if (!props.outstandingReference || props.outstandingReference.trim().length === 0) {
      throw new OutstandingDomainError('outstandingReference is required');
    }
    if (props.amountCents === undefined || props.amountCents < 0) {
      throw new OutstandingDomainError('amountCents must be >= 0');
    }

    this._id = props.id || randomUUID();
    this._tenantId = props.tenantId;
    this._distributorId = props.distributorId;
    this._invoiceId = props.invoiceId;
    this._outstandingReference = props.outstandingReference;
    this._amountCents = props.amountCents;
    this._dueDate = props.dueDate;
    this._status = props.status || 'OPEN';
    this._idempotencyKey = props.idempotencyKey;
    this._version = props.version || 1;
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
  }

  get id(): string { return this._id; }
  get tenantId(): string { return this._tenantId; }
  get distributorId(): string { return this._distributorId; }
  get invoiceId(): string | undefined { return this._invoiceId; }
  get outstandingReference(): string { return this._outstandingReference; }
  get amountCents(): number { return this._amountCents; }
  get dueDate(): Date | undefined { return this._dueDate; }
  get status(): OutstandingStatus { return this._status; }
  get idempotencyKey(): string | undefined { return this._idempotencyKey; }
  get version(): number { return this._version; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
  get domainEvents(): DomainEvent[] { return [...this._domainEvents]; }

  public clearEvents(): void {
    this._domainEvents = [];
  }

  public markPartial(): void {
    this.transitionTo('PARTIAL');
  }

  public markPaid(): void {
    this.transitionTo('PAID');
  }

  public markOverdue(): void {
    this.transitionTo('OVERDUE');
  }

  public writeOff(): void {
    this.transitionTo('WRITTEN_OFF');
  }

  public transitionTo(newStatus: OutstandingStatus): void {
    if (this._status === newStatus) return;

    const validTransitions: Record<OutstandingStatus, OutstandingStatus[]> = {
      OPEN: ['PARTIAL', 'PAID', 'OVERDUE', 'WRITTEN_OFF'],
      PARTIAL: ['PAID', 'OVERDUE', 'WRITTEN_OFF'],
      OVERDUE: ['PARTIAL', 'PAID', 'WRITTEN_OFF'],
      PAID: [],
      WRITTEN_OFF: [],
    };

    const allowed = validTransitions[this._status] || [];
    if (!allowed.includes(newStatus)) {
      throw new InvalidOutstandingStateTransitionError(
        `Cannot transition outstanding record from state '${this._status}' to '${newStatus}'`
      );
    }

    const oldStatus = this._status;
    this._status = newStatus;
    this._updatedAt = new Date();

    this._domainEvents.push({
      id: randomUUID(),
      name: `finance.outstanding.${newStatus.toLowerCase()}`,
      occurredAt: new Date(),
      payload: {
        outstandingId: this._id,
        tenantId: this._tenantId,
        outstandingReference: this._outstandingReference,
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
      outstandingReference: this._outstandingReference,
      amountCents: this._amountCents,
      dueDate: this._dueDate ? this._dueDate.toISOString() : undefined,
      status: this._status,
      idempotencyKey: this._idempotencyKey,
      version: this._version,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
