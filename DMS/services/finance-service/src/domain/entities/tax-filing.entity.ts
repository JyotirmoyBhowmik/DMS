import { randomUUID } from 'node:crypto';
import { DomainEvent } from './credit-note.entity.js';

export class TaxFilingDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaxFilingDomainError';
  }
}

export class InvalidTaxFilingStateTransitionError extends TaxFilingDomainError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTaxFilingStateTransitionError';
  }
}

export class TaxFilingValidationError extends TaxFilingDomainError {
  constructor(public readonly fields: Record<string, string>, message = 'TaxFiling validation failed') {
    const detail = Object.values(fields).join('; ');
    super(detail ? `${message}: ${detail}` : message);
    this.name = 'TaxFilingValidationError';
  }
}

export type TaxFilingStatus = 'DRAFT' | 'FILED' | 'ACCEPTED' | 'REJECTED';

export interface TaxFilingProps {
  id?: string;
  tenantId: string;
  period: string;
  taxType: string;
  taxableAmountCents?: number;
  taxAmountCents?: number;
  status?: TaxFilingStatus;
  acknowledgementNumber?: string;
  filingDate?: Date;
  idempotencyKey?: string;
  version?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class TaxFiling {
  private readonly _id: string;
  private readonly _tenantId: string;
  private readonly _period: string;
  private readonly _taxType: string;
  private readonly _taxableAmountCents: number;
  private readonly _taxAmountCents: number;
  private _status: TaxFilingStatus;
  private _acknowledgementNumber?: string;
  private _filingDate?: Date;
  private readonly _idempotencyKey?: string;
  private _version: number;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: DomainEvent[] = [];

  constructor(props: TaxFilingProps) {
    if (!props.tenantId) throw new TaxFilingDomainError('tenantId is required');
    if (!props.period || props.period.trim().length === 0) {
      throw new TaxFilingDomainError('period is required');
    }
    if (!props.taxType || props.taxType.trim().length === 0) {
      throw new TaxFilingDomainError('taxType is required');
    }

    const taxable = props.taxableAmountCents ?? 0;
    if (taxable < 0) throw new TaxFilingDomainError('taxableAmountCents must be >= 0');

    const tax = props.taxAmountCents ?? 0;
    if (tax < 0) throw new TaxFilingDomainError('taxAmountCents must be >= 0');

    this._id = props.id || randomUUID();
    this._tenantId = props.tenantId;
    this._period = props.period;
    this._taxType = props.taxType;
    this._taxableAmountCents = taxable;
    this._taxAmountCents = tax;
    this._status = props.status || 'DRAFT';
    this._acknowledgementNumber = props.acknowledgementNumber;
    this._filingDate = props.filingDate;
    this._idempotencyKey = props.idempotencyKey;
    this._version = props.version || 1;
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
  }

  get id(): string { return this._id; }
  get tenantId(): string { return this._tenantId; }
  get period(): string { return this._period; }
  get taxType(): string { return this._taxType; }
  get taxableAmountCents(): number { return this._taxableAmountCents; }
  get taxAmountCents(): number { return this._taxAmountCents; }
  get status(): TaxFilingStatus { return this._status; }
  get acknowledgementNumber(): string | undefined { return this._acknowledgementNumber; }
  get filingDate(): Date | undefined { return this._filingDate; }
  get idempotencyKey(): string | undefined { return this._idempotencyKey; }
  get version(): number { return this._version; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
  get domainEvents(): DomainEvent[] { return [...this._domainEvents]; }

  public clearEvents(): void {
    this._domainEvents = [];
  }

  public file(acknowledgementNumber?: string): void {
    if (acknowledgementNumber) this._acknowledgementNumber = acknowledgementNumber;
    this._filingDate = new Date();
    this.transitionTo('FILED');
  }

  public accept(): void {
    this.transitionTo('ACCEPTED');
  }

  public reject(): void {
    this.transitionTo('REJECTED');
  }

  public transitionTo(newStatus: TaxFilingStatus): void {
    if (this._status === newStatus) return;

    const validTransitions: Record<TaxFilingStatus, TaxFilingStatus[]> = {
      DRAFT: ['FILED', 'REJECTED'],
      FILED: ['ACCEPTED', 'REJECTED'],
      ACCEPTED: [],
      REJECTED: ['DRAFT'],
    };

    const allowed = validTransitions[this._status] || [];
    if (!allowed.includes(newStatus)) {
      throw new InvalidTaxFilingStateTransitionError(
        `Cannot transition TaxFiling from state '${this._status}' to '${newStatus}'`
      );
    }

    const oldStatus = this._status;
    this._status = newStatus;
    this._updatedAt = new Date();

    this._domainEvents.push({
      id: randomUUID(),
      name: `finance.tax_filing.${newStatus.toLowerCase()}`,
      occurredAt: new Date(),
      payload: {
        taxFilingId: this._id,
        tenantId: this._tenantId,
        period: this._period,
        taxType: this._taxType,
        taxableAmountCents: this._taxableAmountCents,
        taxAmountCents: this._taxAmountCents,
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
      period: this._period,
      taxType: this._taxType,
      taxableAmountCents: this._taxableAmountCents,
      taxAmountCents: this._taxAmountCents,
      status: this._status,
      acknowledgementNumber: this._acknowledgementNumber,
      filingDate: this._filingDate ? this._filingDate.toISOString() : undefined,
      idempotencyKey: this._idempotencyKey,
      version: this._version,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
