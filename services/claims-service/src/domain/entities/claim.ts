/**
 * Claim Domain Entity.
 * Represents scheme claim requests submitted by distributors:
 * SUBMITTED -> UNDER_REVIEW -> APPROVED / REJECTED -> SETTLED.
 */

export type ClaimStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'SETTLED';

export interface ClaimProps {
  id: string;
  tenantId: string;
  distributorId: string;
  schemeId: string;
  name: string;
  claimCode: string;
  claimAmountCents?: number;
  approvedAmountCents?: number;
  status?: ClaimStatus;
  version?: number;
}

export class Claim {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly distributorId: string;
  public readonly schemeId: string;
  private _name: string;
  public readonly claimCode: string;
  private _claimAmountCents: number;
  private _approvedAmountCents: number;
  private _status: ClaimStatus;
  private _version: number;

  public readonly domainEvents: Array<{ type: string; payload: any }> = [];

  constructor(props: ClaimProps) {
    if (!props.id || !props.tenantId || !props.distributorId || !props.schemeId || !props.name || !props.claimCode) {
      throw new Error('Claim must have id, tenantId, distributorId, schemeId, name, and claimCode');
    }
    if (props.claimAmountCents !== undefined && props.claimAmountCents < 0) {
      throw new Error('claimAmountCents must be non-negative');
    }
    if (props.approvedAmountCents !== undefined && props.approvedAmountCents < 0) {
      throw new Error('approvedAmountCents must be non-negative');
    }

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.distributorId = props.distributorId;
    this.schemeId = props.schemeId;
    this._name = props.name;
    this.claimCode = props.claimCode;
    this._claimAmountCents = props.claimAmountCents ?? 0;
    this._approvedAmountCents = props.approvedAmountCents ?? 0;
    this._status = props.status ?? 'SUBMITTED';
    this._version = props.version ?? 1;
  }

  get name(): string { return this._name; }
  get claimAmountCents(): number { return this._claimAmountCents; }
  get approvedAmountCents(): number { return this._approvedAmountCents; }
  get status(): ClaimStatus { return this._status; }
  get version(): number { return this._version; }

  static create(props: ClaimProps): Claim {
    const claim = new Claim(props);
    claim.domainEvents.push({
      type: 'claims.claim.created',
      payload: {
        id: claim.id,
        distributorId: claim.distributorId,
        schemeId: claim.schemeId,
        name: claim.name,
        claimCode: claim.claimCode,
        claimAmountCents: claim.claimAmountCents,
        approvedAmountCents: claim.approvedAmountCents,
        status: claim.status,
      },
    });
    return claim;
  }

  updateStatus(newStatus: ClaimStatus, approvedCents?: number): void {
    if (this._status === 'SETTLED' || this._status === 'REJECTED') {
      throw new Error(`Cannot transition from final status ${this._status}`);
    }

    if (approvedCents !== undefined) {
      if (approvedCents < 0) {
        throw new Error('approvedAmountCents must be non-negative');
      }
      if (approvedCents > this._claimAmountCents) {
        throw new Error('approvedAmountCents cannot exceed claimAmountCents');
      }
      this._approvedAmountCents = approvedCents;
    }

    this._status = newStatus;
    this._version++;

    this.domainEvents.push({
      type: 'claims.claim.status_updated',
      payload: { id: this.id, status: this._status, approvedAmountCents: this._approvedAmountCents, version: this._version },
    });
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      distributorId: this.distributorId,
      schemeId: this.schemeId,
      name: this._name,
      claimCode: this.claimCode,
      claimAmountCents: this._claimAmountCents,
      approvedAmountCents: this._approvedAmountCents,
      status: this._status,
      version: this._version,
    };
  }
}
