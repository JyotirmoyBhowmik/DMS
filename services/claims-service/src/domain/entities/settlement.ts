import { randomUUID } from 'node:crypto';

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

export class InvalidStateTransitionError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidStateTransitionError';
  }
}

export type SettlementStatus =
  | 'INITIATED'
  | 'PROCESSING'
  | 'SETTLED'
  | 'FAILED'
  | 'CANCELLED';

export interface SettlementProps {
  id?: string;
  tenantId: string;
  settlementCode: string;
  claimId: string;
  distributorId: string;
  amountCents: number;
  paymentReference?: string;
  status?: SettlementStatus;
  version?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DomainEvent {
  id: string;
  name: string;
  occurredAt: Date;
  payload: Record<string, any>;
}

export class Settlement {
  private readonly _id: string;
  private readonly _tenantId: string;
  private readonly _settlementCode: string;
  private readonly _claimId: string;
  private readonly _distributorId: string;
  private _amountCents: number;
  private _paymentReference?: string;
  private _status: SettlementStatus;
  private _version: number;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: DomainEvent[] = [];

  constructor(props: SettlementProps) {
    if (!props.tenantId) throw new DomainError('tenantId is required');
    if (!props.settlementCode || props.settlementCode.trim().length === 0) {
      throw new DomainError('settlementCode is required');
    }
    if (!props.claimId) throw new DomainError('claimId is required');
    if (!props.distributorId) throw new DomainError('distributorId is required');
    if (props.amountCents === undefined || props.amountCents < 0) {
      throw new DomainError('amountCents must be >= 0');
    }

    this._id = props.id || randomUUID();
    this._tenantId = props.tenantId;
    this._settlementCode = props.settlementCode;
    this._claimId = props.claimId;
    this._distributorId = props.distributorId;
    this._amountCents = props.amountCents;
    this._paymentReference = props.paymentReference;
    this._status = props.status || 'INITIATED';
    this._version = props.version || 1;
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
  }

  get id(): string { return this._id; }
  get tenantId(): string { return this._tenantId; }
  get settlementCode(): string { return this._settlementCode; }
  get claimId(): string { return this._claimId; }
  get distributorId(): string { return this._distributorId; }
  get amountCents(): number { return this._amountCents; }
  get paymentReference(): string | undefined { return this._paymentReference; }
  get status(): SettlementStatus { return this._status; }
  get version(): number { return this._version; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
  get domainEvents(): DomainEvent[] { return [...this._domainEvents]; }

  public clearEvents(): void {
    this._domainEvents = [];
  }

  public updateStatus(newStatus: SettlementStatus, paymentReference?: string): void {
    if (this._status === newStatus) return;

    const validTransitions: Record<SettlementStatus, SettlementStatus[]> = {
      INITIATED: ['PROCESSING', 'CANCELLED'],
      PROCESSING: ['SETTLED', 'FAILED', 'CANCELLED'],
      SETTLED: [],
      FAILED: ['PROCESSING', 'CANCELLED'],
      CANCELLED: [],
    };

    const allowed = validTransitions[this._status] || [];
    if (!allowed.includes(newStatus)) {
      throw new InvalidStateTransitionError(
        `Cannot transition settlement from state '${this._status}' to '${newStatus}'`
      );
    }

    if (paymentReference !== undefined) {
      this._paymentReference = paymentReference;
    }

    const oldStatus = this._status;
    this._status = newStatus;
    this._updatedAt = new Date();

    this._domainEvents.push({
      id: randomUUID(),
      name: 'claims.settlement.status_updated',
      occurredAt: new Date(),
      payload: {
        settlementId: this._id,
        tenantId: this._tenantId,
        settlementCode: this._settlementCode,
        claimId: this._claimId,
        oldStatus,
        newStatus: this._status,
        amountCents: this._amountCents,
        paymentReference: this._paymentReference,
        version: this._version,
      },
    });
  }

  public toJSON() {
    return {
      id: this._id,
      tenantId: this._tenantId,
      settlementCode: this._settlementCode,
      claimId: this._claimId,
      distributorId: this._distributorId,
      amountCents: this._amountCents,
      paymentReference: this._paymentReference,
      status: this._status,
      version: this._version,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
