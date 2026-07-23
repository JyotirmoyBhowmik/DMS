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

export type ClaimReconciliationStatus =
  | 'DRAFT'
  | 'IN_PROGRESS'
  | 'RECONCILED'
  | 'DISCREPANCY_FLAGGED'
  | 'CLOSED';

export interface ClaimReconciliationProps {
  id?: string;
  tenantId: string;
  reconciliationCode: string;
  distributorId: string;
  totalClaimedCents: number;
  totalSettledCents?: number;
  discrepancyCents?: number;
  status?: ClaimReconciliationStatus;
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

export class ClaimReconciliation {
  private readonly _id: string;
  private readonly _tenantId: string;
  private readonly _reconciliationCode: string;
  private readonly _distributorId: string;
  private _totalClaimedCents: number;
  private _totalSettledCents: number;
  private _discrepancyCents: number;
  private _status: ClaimReconciliationStatus;
  private _version: number;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: DomainEvent[] = [];

  constructor(props: ClaimReconciliationProps) {
    if (!props.tenantId) throw new DomainError('tenantId is required');
    if (!props.reconciliationCode || props.reconciliationCode.trim().length === 0) {
      throw new DomainError('reconciliationCode is required');
    }
    if (!props.distributorId) throw new DomainError('distributorId is required');
    if (props.totalClaimedCents === undefined || props.totalClaimedCents < 0) {
      throw new DomainError('totalClaimedCents must be >= 0');
    }

    const settled = props.totalSettledCents ?? 0;
    if (settled < 0) throw new DomainError('totalSettledCents must be >= 0');

    this._id = props.id || randomUUID();
    this._tenantId = props.tenantId;
    this._reconciliationCode = props.reconciliationCode;
    this._distributorId = props.distributorId;
    this._totalClaimedCents = props.totalClaimedCents;
    this._totalSettledCents = settled;
    this._discrepancyCents = props.discrepancyCents ?? (this._totalClaimedCents - this._totalSettledCents);
    this._status = props.status || 'DRAFT';
    this._version = props.version || 1;
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
  }

  get id(): string { return this._id; }
  get tenantId(): string { return this._tenantId; }
  get reconciliationCode(): string { return this._reconciliationCode; }
  get distributorId(): string { return this._distributorId; }
  get totalClaimedCents(): number { return this._totalClaimedCents; }
  get totalSettledCents(): number { return this._totalSettledCents; }
  get discrepancyCents(): number { return this._discrepancyCents; }
  get status(): ClaimReconciliationStatus { return this._status; }
  get version(): number { return this._version; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
  get domainEvents(): DomainEvent[] { return [...this._domainEvents]; }

  public clearEvents(): void {
    this._domainEvents = [];
  }

  public updateStatus(newStatus: ClaimReconciliationStatus, totalSettledCents?: number): void {
    if (this._status === newStatus) return;

    const validTransitions: Record<ClaimReconciliationStatus, ClaimReconciliationStatus[]> = {
      DRAFT: ['IN_PROGRESS', 'CLOSED'],
      IN_PROGRESS: ['RECONCILED', 'DISCREPANCY_FLAGGED', 'CLOSED'],
      RECONCILED: ['CLOSED'],
      DISCREPANCY_FLAGGED: ['RECONCILED', 'CLOSED'],
      CLOSED: [],
    };

    const allowed = validTransitions[this._status] || [];
    if (!allowed.includes(newStatus)) {
      throw new InvalidStateTransitionError(
        `Cannot transition claim reconciliation from state '${this._status}' to '${newStatus}'`
      );
    }

    if (totalSettledCents !== undefined) {
      if (totalSettledCents < 0) {
        throw new DomainError('totalSettledCents must be >= 0');
      }
      this._totalSettledCents = totalSettledCents;
      this._discrepancyCents = this._totalClaimedCents - this._totalSettledCents;
    }

    const oldStatus = this._status;
    this._status = newStatus;
    this._updatedAt = new Date();

    this._domainEvents.push({
      id: randomUUID(),
      name: 'claims.reconciliation.status_updated',
      occurredAt: new Date(),
      payload: {
        reconciliationId: this._id,
        tenantId: this._tenantId,
        reconciliationCode: this._reconciliationCode,
        oldStatus,
        newStatus: this._status,
        totalClaimedCents: this._totalClaimedCents,
        totalSettledCents: this._totalSettledCents,
        discrepancyCents: this._discrepancyCents,
        version: this._version,
      },
    });
  }

  public toJSON() {
    return {
      id: this._id,
      tenantId: this._tenantId,
      reconciliationCode: this._reconciliationCode,
      distributorId: this._distributorId,
      totalClaimedCents: this._totalClaimedCents,
      totalSettledCents: this._totalSettledCents,
      discrepancyCents: this._discrepancyCents,
      status: this._status,
      version: this._version,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
