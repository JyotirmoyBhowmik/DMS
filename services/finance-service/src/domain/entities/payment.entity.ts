import { randomUUID } from 'node:crypto';
import { DomainEvent } from './credit-note.entity.js';

export class PaymentDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentDomainError';
  }
}

export class InvalidPaymentStateTransitionError extends PaymentDomainError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPaymentStateTransitionError';
  }
}

export class PaymentValidationError extends PaymentDomainError {
  constructor(public readonly fields: Record<string, string>, message = 'Payment validation failed') {
    super(message);
    this.name = 'PaymentValidationError';
  }
}

export type PaymentStatus = 'DRAFT' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';

export interface PaymentProps {
  id?: string;
  tenantId: string;
  distributorId: string;
  invoiceId?: string;
  paymentReference: string;
  amountCents: number;
  paymentMethod?: string;
  currency?: string;
  status?: PaymentStatus;
  idempotencyKey?: string;
  version?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Payment {
  private readonly _id: string;
  private readonly _tenantId: string;
  private readonly _distributorId: string;
  private readonly _invoiceId?: string;
  private readonly _paymentReference: string;
  private readonly _amountCents: number;
  private readonly _paymentMethod: string;
  private readonly _currency: string;
  private _status: PaymentStatus;
  private readonly _idempotencyKey?: string;
  private _version: number;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: DomainEvent[] = [];

  constructor(props: PaymentProps) {
    if (!props.tenantId) throw new PaymentDomainError('tenantId is required');
    if (!props.distributorId) throw new PaymentDomainError('distributorId is required');
    if (!props.paymentReference || props.paymentReference.trim().length === 0) {
      throw new PaymentDomainError('paymentReference is required');
    }
    if (props.amountCents === undefined || props.amountCents <= 0) {
      throw new PaymentDomainError('amountCents must be > 0');
    }

    this._id = props.id || randomUUID();
    this._tenantId = props.tenantId;
    this._distributorId = props.distributorId;
    this._invoiceId = props.invoiceId;
    this._paymentReference = props.paymentReference;
    this._amountCents = props.amountCents;
    this._paymentMethod = props.paymentMethod || 'BANK_TRANSFER';
    this._currency = props.currency || 'USD';
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
  get paymentReference(): string { return this._paymentReference; }
  get amountCents(): number { return this._amountCents; }
  get paymentMethod(): string { return this._paymentMethod; }
  get currency(): string { return this._currency; }
  get status(): PaymentStatus { return this._status; }
  get idempotencyKey(): string | undefined { return this._idempotencyKey; }
  get version(): number { return this._version; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
  get domainEvents(): DomainEvent[] { return [...this._domainEvents]; }

  public clearEvents(): void {
    this._domainEvents = [];
  }

  public process(): void {
    this.transitionTo('PROCESSING');
  }

  public complete(): void {
    this.transitionTo('COMPLETED');
  }

  public fail(): void {
    this.transitionTo('FAILED');
  }

  public refund(): void {
    this.transitionTo('REFUNDED');
  }

  public transitionTo(newStatus: PaymentStatus): void {
    if (this._status === newStatus) return;

    const validTransitions: Record<PaymentStatus, PaymentStatus[]> = {
      DRAFT: ['PROCESSING', 'FAILED'],
      PROCESSING: ['COMPLETED', 'FAILED'],
      COMPLETED: ['REFUNDED'],
      FAILED: [],
      REFUNDED: [],
    };

    const allowed = validTransitions[this._status] || [];
    if (!allowed.includes(newStatus)) {
      throw new InvalidPaymentStateTransitionError(
        `Cannot transition payment from state '${this._status}' to '${newStatus}'`
      );
    }

    const oldStatus = this._status;
    this._status = newStatus;
    this._updatedAt = new Date();

    this._domainEvents.push({
      id: randomUUID(),
      name: `finance.payment.${newStatus.toLowerCase()}`,
      occurredAt: new Date(),
      payload: {
        paymentId: this._id,
        tenantId: this._tenantId,
        paymentReference: this._paymentReference,
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
      paymentReference: this._paymentReference,
      amountCents: this._amountCents,
      paymentMethod: this._paymentMethod,
      currency: this._currency,
      status: this._status,
      idempotencyKey: this._idempotencyKey,
      version: this._version,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
