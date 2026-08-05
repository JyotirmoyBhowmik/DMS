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

export type SchemeClaimStatus =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'SETTLED';

export interface SchemeClaimProps {
  id?: string;
  tenantId: string;
  claimCode: string;
  schemeId: string;
  distributorId: string;
  claimAmountCents: number;
  approvedAmountCents?: number;
  status?: SchemeClaimStatus;
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

export class SchemeClaim {
  private readonly _id: string;
  private readonly _tenantId: string;
  private readonly _claimCode: string;
  private readonly _schemeId: string;
  private readonly _distributorId: string;
  private _claimAmountCents: number;
  private _approvedAmountCents: number;
  private _status: SchemeClaimStatus;
  private _version: number;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: DomainEvent[] = [];

  constructor(props: SchemeClaimProps) {
    if (!props.tenantId) throw new DomainError('tenantId is required');
    if (!props.claimCode || props.claimCode.trim().length === 0) {
      throw new DomainError('claimCode is required');
    }
    if (!props.schemeId) throw new DomainError('schemeId is required');
    if (!props.distributorId) throw new DomainError('distributorId is required');
    if (props.claimAmountCents === undefined || props.claimAmountCents < 0) {
      throw new DomainError('claimAmountCents must be >= 0');
    }

    const approved = props.approvedAmountCents ?? 0;
    if (approved < 0) throw new DomainError('approvedAmountCents must be >= 0');
    if (approved > props.claimAmountCents) {
      throw new DomainError('approvedAmountCents cannot exceed claimAmountCents');
    }

    this._id = props.id || randomUUID();
    this._tenantId = props.tenantId;
    this._claimCode = props.claimCode;
    this._schemeId = props.schemeId;
    this._distributorId = props.distributorId;
    this._claimAmountCents = props.claimAmountCents;
    this._approvedAmountCents = approved;
    this._status = props.status || 'SUBMITTED';
    this._version = props.version || 1;
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
  }

  get id(): string { return this._id; }
  get tenantId(): string { return this._tenantId; }
  get claimCode(): string { return this._claimCode; }
  get schemeId(): string { return this._schemeId; }
  get distributorId(): string { return this._distributorId; }
  get claimAmountCents(): number { return this._claimAmountCents; }
  get approvedAmountCents(): number { return this._approvedAmountCents; }
  get status(): SchemeClaimStatus { return this._status; }
  get version(): number { return this._version; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
  get domainEvents(): DomainEvent[] { return [...this._domainEvents]; }

  public clearEvents(): void {
    this._domainEvents = [];
  }

  public updateStatus(newStatus: SchemeClaimStatus, approvedAmountCents?: number): void {
    if (this._status === newStatus) return;

    const validTransitions: Record<SchemeClaimStatus, SchemeClaimStatus[]> = {
      SUBMITTED: ['UNDER_REVIEW', 'REJECTED'],
      UNDER_REVIEW: ['APPROVED', 'REJECTED'],
      APPROVED: ['SETTLED'],
      REJECTED: [],
      SETTLED: [],
    };

    const allowed = validTransitions[this._status] || [];
    if (!allowed.includes(newStatus)) {
      throw new InvalidStateTransitionError(
        `Cannot transition scheme claim from state '${this._status}' to '${newStatus}'`
      );
    }

    if (newStatus === 'APPROVED' && approvedAmountCents !== undefined) {
      if (approvedAmountCents < 0 || approvedAmountCents > this._claimAmountCents) {
        throw new DomainError('approvedAmountCents must be between 0 and claimAmountCents');
      }
      this._approvedAmountCents = approvedAmountCents;
    }

    const oldStatus = this._status;
    this._status = newStatus;
    this._updatedAt = new Date();

    this._domainEvents.push({
      id: randomUUID(),
      name: 'claims.scheme_claim.status_updated',
      occurredAt: new Date(),
      payload: {
        schemeClaimId: this._id,
        tenantId: this._tenantId,
        claimCode: this._claimCode,
        oldStatus,
        newStatus: this._status,
        approvedAmountCents: this._approvedAmountCents,
        version: this._version,
      },
    });
  }

  public toJSON() {
    return {
      id: this._id,
      tenantId: this._tenantId,
      claimCode: this._claimCode,
      schemeId: this._schemeId,
      distributorId: this._distributorId,
      claimAmountCents: this._claimAmountCents,
      approvedAmountCents: this._approvedAmountCents,
      status: this._status,
      version: this._version,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
