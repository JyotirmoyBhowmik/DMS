/**
 * Discount Domain Entity.
 * Represents promotional discount rules:
 * DRAFT -> ACTIVE -> EXPIRED (or ARCHIVED).
 */

export type DiscountStatus = 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'ARCHIVED';
export type DiscountType = 'PERCENTAGE' | 'FLAT_AMOUNT';

export interface DiscountProps {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  discountType?: DiscountType;
  value: number;
  minOrderAmountCents?: number;
  status?: DiscountStatus;
  version?: number;
}

export class Discount {
  public readonly id: string;
  public readonly tenantId: string;
  private _name: string;
  public readonly code: string;
  public readonly discountType: DiscountType;
  private _value: number;
  private _minOrderAmountCents: number;
  private _status: DiscountStatus;
  private _version: number;

  public readonly domainEvents: Array<{ type: string; payload: any }> = [];

  constructor(props: DiscountProps) {
    if (!props.id || !props.tenantId || !props.name || !props.code) {
      throw new Error('Discount must have id, tenantId, name, and code');
    }
    if (props.value <= 0) {
      throw new Error('Discount value must be positive');
    }

    this.id = props.id;
    this.tenantId = props.tenantId;
    this._name = props.name;
    this.code = props.code;
    this.discountType = props.discountType ?? 'PERCENTAGE';
    this._value = props.value;
    this._minOrderAmountCents = props.minOrderAmountCents ?? 0;
    this._status = props.status ?? 'DRAFT';
    this._version = props.version ?? 1;
  }

  get name(): string { return this._name; }
  get value(): number { return this._value; }
  get minOrderAmountCents(): number { return this._minOrderAmountCents; }
  get status(): DiscountStatus { return this._status; }
  get version(): number { return this._version; }

  static create(props: DiscountProps): Discount {
    const discount = new Discount(props);
    discount.domainEvents.push({
      type: 'pricing.discount.created',
      payload: {
        id: discount.id,
        name: discount.name,
        code: discount.code,
        discountType: discount.discountType,
        value: discount.value,
        status: discount.status,
      },
    });
    return discount;
  }

  updateStatus(newStatus: DiscountStatus): void {
    if (this._status === 'ARCHIVED') {
      throw new Error(`Cannot transition from final status ARCHIVED`);
    }

    const validTransitions: Record<DiscountStatus, DiscountStatus[]> = {
      DRAFT: ['ACTIVE', 'ARCHIVED'],
      ACTIVE: ['EXPIRED', 'ARCHIVED'],
      EXPIRED: ['ACTIVE', 'ARCHIVED'],
      ARCHIVED: [],
    };

    const allowed = validTransitions[this._status];
    if (!allowed.includes(newStatus)) {
      throw new Error(`Illegal state transition from ${this._status} to ${newStatus}`);
    }

    this._status = newStatus;
    this._version++;

    this.domainEvents.push({
      type: 'pricing.discount.status_updated',
      payload: { id: this.id, status: this._status, version: this._version },
    });
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      name: this._name,
      code: this.code,
      discountType: this.discountType,
      value: this._value,
      minOrderAmountCents: this._minOrderAmountCents,
      status: this._status,
      version: this._version,
    };
  }
}
