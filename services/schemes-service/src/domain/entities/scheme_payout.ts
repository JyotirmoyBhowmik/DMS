/**
 * SchemePayout Domain Entity.
 * Represents promotional scheme payout to distributors:
 * PENDING -> APPROVED -> DISBURSED / REJECTED.
 */

export type SchemePayoutStatus = 'PENDING' | 'APPROVED' | 'DISBURSED' | 'REJECTED';
export type PayoutType = 'CREDIT_NOTE' | 'BANK_TRANSFER' | 'CHEQUE';

export interface SchemePayoutProps {
  id: string;
  tenantId: string;
  schemeId: string;
  distributorId: string;
  claimId?: string;
  name: string;
  payoutCode: string;
  amountCents?: number;
  payoutType?: PayoutType;
  status?: SchemePayoutStatus;
  version?: number;
}

export class SchemePayout {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly schemeId: string;
  public readonly distributorId: string;
  public readonly claimId: string;
  private _name: string;
  public readonly payoutCode: string;
  private _amountCents: number;
  public readonly payoutType: PayoutType;
  private _status: SchemePayoutStatus;
  private _version: number;

  public readonly domainEvents: Array<{ type: string; payload: any }> = [];

  constructor(props: SchemePayoutProps) {
    if (!props.id || !props.tenantId || !props.schemeId || !props.distributorId || !props.name || !props.payoutCode) {
      throw new Error('SchemePayout must have id, tenantId, schemeId, distributorId, name, and payoutCode');
    }
    if (props.amountCents !== undefined && props.amountCents < 0) {
      throw new Error('amountCents must be non-negative');
    }

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.schemeId = props.schemeId;
    this.distributorId = props.distributorId;
    this.claimId = props.claimId ?? '';
    this._name = props.name;
    this.payoutCode = props.payoutCode;
    this._amountCents = props.amountCents ?? 0;
    this.payoutType = props.payoutType ?? 'CREDIT_NOTE';
    this._status = props.status ?? 'PENDING';
    this._version = props.version ?? 1;
  }

  get name(): string { return this._name; }
  get amountCents(): number { return this._amountCents; }
  get status(): SchemePayoutStatus { return this._status; }
  get version(): number { return this._version; }

  static create(props: SchemePayoutProps): SchemePayout {
    const payout = new SchemePayout(props);
    payout.domainEvents.push({
      type: 'schemes.scheme_payout.created',
      payload: {
        id: payout.id,
        schemeId: payout.schemeId,
        distributorId: payout.distributorId,
        name: payout.name,
        payoutCode: payout.payoutCode,
        amountCents: payout.amountCents,
        payoutType: payout.payoutType,
        status: payout.status,
      },
    });
    return payout;
  }

  updateStatus(newStatus: SchemePayoutStatus): void {
    if (this._status === 'DISBURSED' || this._status === 'REJECTED') {
      throw new Error(`Cannot transition from final status ${this._status}`);
    }

    this._status = newStatus;
    this._version++;

    this.domainEvents.push({
      type: 'schemes.scheme_payout.status_updated',
      payload: { id: this.id, status: this._status, version: this._version },
    });
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      schemeId: this.schemeId,
      distributorId: this.distributorId,
      claimId: this.claimId,
      name: this._name,
      payoutCode: this.payoutCode,
      amountCents: this._amountCents,
      payoutType: this.payoutType,
      status: this._status,
      version: this._version,
    };
  }
}
