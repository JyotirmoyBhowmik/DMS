import { randomUUID } from 'node:crypto';
import { DomainEvent } from './credit-note.entity.js';

export class AgeingReportDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgeingReportDomainError';
  }
}

export class InvalidAgeingReportStateTransitionError extends AgeingReportDomainError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAgeingReportStateTransitionError';
  }
}

export class AgeingReportValidationError extends AgeingReportDomainError {
  constructor(public readonly fields: Record<string, string>, message = 'AgeingReport validation failed') {
    const detail = Object.values(fields).join('; ');
    super(detail ? `${message}: ${detail}` : message);
    this.name = 'AgeingReportValidationError';
  }
}

export type AgeingReportStatus = 'GENERATED' | 'VERIFIED' | 'RECONCILED' | 'ARCHIVED';

export interface AgeingReportProps {
  id?: string;
  tenantId: string;
  distributorId: string;
  asOfDate: Date;
  currentBucketCents?: number;
  bucket1To30Cents?: number;
  bucket31To60Cents?: number;
  bucket61To90Cents?: number;
  bucket90PlusCents?: number;
  totalOutstandingCents?: number;
  status?: AgeingReportStatus;
  idempotencyKey?: string;
  version?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class AgeingReport {
  private readonly _id: string;
  private readonly _tenantId: string;
  private readonly _distributorId: string;
  private readonly _asOfDate: Date;
  private readonly _currentBucketCents: number;
  private readonly _bucket1To30Cents: number;
  private readonly _bucket31To60Cents: number;
  private readonly _bucket61To90Cents: number;
  private readonly _bucket90PlusCents: number;
  private readonly _totalOutstandingCents: number;
  private _status: AgeingReportStatus;
  private readonly _idempotencyKey?: string;
  private _version: number;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: DomainEvent[] = [];

  constructor(props: AgeingReportProps) {
    if (!props.tenantId) throw new AgeingReportDomainError('tenantId is required');
    if (!props.distributorId) throw new AgeingReportDomainError('distributorId is required');
    if (!props.asOfDate) throw new AgeingReportDomainError('asOfDate is required');

    const current = props.currentBucketCents ?? 0;
    const b1_30 = props.bucket1To30Cents ?? 0;
    const b31_60 = props.bucket31To60Cents ?? 0;
    const b61_90 = props.bucket61To90Cents ?? 0;
    const b90Plus = props.bucket90PlusCents ?? 0;

    if (current < 0) throw new AgeingReportDomainError('currentBucketCents must be >= 0');
    if (b1_30 < 0) throw new AgeingReportDomainError('bucket1To30Cents must be >= 0');
    if (b31_60 < 0) throw new AgeingReportDomainError('bucket31To60Cents must be >= 0');
    if (b61_90 < 0) throw new AgeingReportDomainError('bucket61To90Cents must be >= 0');
    if (b90Plus < 0) throw new AgeingReportDomainError('bucket90PlusCents must be >= 0');

    const calculatedTotal = current + b1_30 + b31_60 + b61_90 + b90Plus;

    if (props.totalOutstandingCents !== undefined && props.totalOutstandingCents !== calculatedTotal) {
      throw new AgeingReportDomainError(
        `totalOutstandingCents (${props.totalOutstandingCents}) must equal sum of buckets (${calculatedTotal})`
      );
    }

    this._id = props.id || randomUUID();
    this._tenantId = props.tenantId;
    this._distributorId = props.distributorId;
    this._asOfDate = props.asOfDate;
    this._currentBucketCents = current;
    this._bucket1To30Cents = b1_30;
    this._bucket31To60Cents = b31_60;
    this._bucket61To90Cents = b61_90;
    this._bucket90PlusCents = b90Plus;
    this._totalOutstandingCents = calculatedTotal;
    this._status = props.status || 'GENERATED';
    this._idempotencyKey = props.idempotencyKey;
    this._version = props.version || 1;
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
  }

  get id(): string { return this._id; }
  get tenantId(): string { return this._tenantId; }
  get distributorId(): string { return this._distributorId; }
  get asOfDate(): Date { return this._asOfDate; }
  get currentBucketCents(): number { return this._currentBucketCents; }
  get bucket1To30Cents(): number { return this._bucket1To30Cents; }
  get bucket31To60Cents(): number { return this._bucket31To60Cents; }
  get bucket61To90Cents(): number { return this._bucket61To90Cents; }
  get bucket90PlusCents(): number { return this._bucket90PlusCents; }
  get totalOutstandingCents(): number { return this._totalOutstandingCents; }
  get status(): AgeingReportStatus { return this._status; }
  get idempotencyKey(): string | undefined { return this._idempotencyKey; }
  get version(): number { return this._version; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
  get domainEvents(): DomainEvent[] { return [...this._domainEvents]; }

  public clearEvents(): void {
    this._domainEvents = [];
  }

  public verify(): void {
    this.transitionTo('VERIFIED');
  }

  public reconcile(): void {
    this.transitionTo('RECONCILED');
  }

  public archive(): void {
    this.transitionTo('ARCHIVED');
  }

  public transitionTo(newStatus: AgeingReportStatus): void {
    if (this._status === newStatus) return;

    const validTransitions: Record<AgeingReportStatus, AgeingReportStatus[]> = {
      GENERATED: ['VERIFIED', 'RECONCILED', 'ARCHIVED'],
      VERIFIED: ['RECONCILED', 'ARCHIVED'],
      RECONCILED: ['ARCHIVED'],
      ARCHIVED: [],
    };

    const allowed = validTransitions[this._status] || [];
    if (!allowed.includes(newStatus)) {
      throw new InvalidAgeingReportStateTransitionError(
        `Cannot transition ageing report from state '${this._status}' to '${newStatus}'`
      );
    }

    const oldStatus = this._status;
    this._status = newStatus;
    this._updatedAt = new Date();

    this._domainEvents.push({
      id: randomUUID(),
      name: `finance.ageing_report.${newStatus.toLowerCase()}`,
      occurredAt: new Date(),
      payload: {
        reportId: this._id,
        tenantId: this._tenantId,
        distributorId: this._distributorId,
        asOfDate: this._asOfDate.toISOString(),
        totalOutstandingCents: this._totalOutstandingCents,
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
      asOfDate: this._asOfDate.toISOString(),
      currentBucketCents: this._currentBucketCents,
      bucket1To30Cents: this._bucket1To30Cents,
      bucket31To60Cents: this._bucket31To60Cents,
      bucket61To90Cents: this._bucket61To90Cents,
      bucket90PlusCents: this._bucket90PlusCents,
      totalOutstandingCents: this._totalOutstandingCents,
      status: this._status,
      idempotencyKey: this._idempotencyKey,
      version: this._version,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
