/**
 * PriceList Domain Entity.
 * Represents product pricing tiers and price lists:
 * DRAFT -> ACTIVE -> INACTIVE (or ARCHIVED).
 */

export type PriceListStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export interface PriceListProps {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  currency?: string;
  status?: PriceListStatus;
  validFrom?: Date | string;
  validTo?: Date | string;
  version?: number;
}

export class PriceList {
  public readonly id: string;
  public readonly tenantId: string;
  private _name: string;
  public readonly code: string;
  public readonly currency: string;
  private _status: PriceListStatus;
  private _validFrom?: Date;
  private _validTo?: Date;
  private _version: number;

  public readonly domainEvents: Array<{ type: string; payload: any }> = [];

  constructor(props: PriceListProps) {
    if (!props.id || !props.tenantId || !props.name || !props.code) {
      throw new Error('PriceList must have id, tenantId, name, and code');
    }

    const vFrom = props.validFrom ? new Date(props.validFrom) : undefined;
    const vTo = props.validTo ? new Date(props.validTo) : undefined;

    if (vFrom && vTo && vFrom > vTo) {
      throw new Error('validFrom cannot be after validTo');
    }

    this.id = props.id;
    this.tenantId = props.tenantId;
    this._name = props.name;
    this.code = props.code;
    this.currency = props.currency ?? 'INR';
    this._status = props.status ?? 'DRAFT';
    this._validFrom = vFrom;
    this._validTo = vTo;
    this._version = props.version ?? 1;
  }

  get name(): string { return this._name; }
  get status(): PriceListStatus { return this._status; }
  get validFrom(): Date | undefined { return this._validFrom; }
  get validTo(): Date | undefined { return this._validTo; }
  get version(): number { return this._version; }

  static create(props: PriceListProps): PriceList {
    const list = new PriceList(props);
    list.domainEvents.push({
      type: 'pricing.price_list.created',
      payload: {
        id: list.id,
        name: list.name,
        code: list.code,
        currency: list.currency,
        status: list.status,
      },
    });
    return list;
  }

  updateStatus(newStatus: PriceListStatus): void {
    if (this._status === 'ARCHIVED') {
      throw new Error(`Cannot transition from final status ARCHIVED`);
    }

    const validTransitions: Record<PriceListStatus, PriceListStatus[]> = {
      DRAFT: ['ACTIVE', 'ARCHIVED'],
      ACTIVE: ['INACTIVE', 'ARCHIVED'],
      INACTIVE: ['ACTIVE', 'ARCHIVED'],
      ARCHIVED: [],
    };

    const allowed = validTransitions[this._status];
    if (!allowed.includes(newStatus)) {
      throw new Error(`Illegal state transition from ${this._status} to ${newStatus}`);
    }

    this._status = newStatus;
    this._version++;

    this.domainEvents.push({
      type: 'pricing.price_list.status_updated',
      payload: { id: this.id, status: this._status, version: this._version },
    });
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      name: this._name,
      code: this.code,
      currency: this.currency,
      status: this._status,
      validFrom: this._validFrom?.toISOString(),
      validTo: this._validTo?.toISOString(),
      version: this._version,
    };
  }
}
