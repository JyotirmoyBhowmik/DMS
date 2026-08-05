import { Money } from '../value-objects/money.js';

export interface DistributorProps {
  id: string;
  tenantId: string;
  name: string;
  region: string;
  creditLimit: Money;
  balance?: Money;
  version?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Distributor {
  public readonly id: string;
  public readonly tenantId: string;
  private _name: string;
  private _region: string;
  private _creditLimit: Money;
  private _balance: Money;
  private _version: number;
  public readonly createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: {
    id: string;
    tenantId: string;
    name: string;
    region: string;
    creditLimit: Money;
    balance: Money;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.validate(props);
    this.id = props.id;
    this.tenantId = props.tenantId;
    this._name = props.name;
    this._region = props.region;
    this._creditLimit = props.creditLimit;
    this._balance = props.balance;
    this._version = props.version;
    this.createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  private validate(props: {
    id: string;
    tenantId: string;
    name: string;
    region: string;
  }): void {
    if (!props.id || props.id.trim().length === 0) {
      throw new Error('Distributor ID cannot be empty');
    }
    if (!props.tenantId || props.tenantId.trim().length === 0) {
      throw new Error('Tenant ID cannot be empty');
    }
    if (!props.name || props.name.trim().length === 0) {
      throw new Error('Distributor name cannot be empty');
    }
    if (!props.region || props.region.trim().length === 0) {
      throw new Error('Distributor region cannot be empty');
    }
  }

  static create(props: {
    id: string;
    tenantId: string;
    name: string;
    region: string;
    creditLimit: number | Money;
    balance?: number | Money;
    version?: number;
    createdAt?: Date;
    updatedAt?: Date;
  }): Distributor {
    const limit = props.creditLimit instanceof Money 
      ? props.creditLimit 
      : Money.fromCents(props.creditLimit);
      
    const balVal = props.balance !== undefined 
      ? (props.balance instanceof Money ? props.balance : Money.fromCents(props.balance))
      : Money.zero(limit.currency);

    return new Distributor({
      id: props.id,
      tenantId: props.tenantId,
      name: props.name,
      region: props.region,
      creditLimit: limit,
      balance: balVal,
      version: props.version ?? 1,
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    });
  }

  get name(): string { return this._name; }
  get region(): string { return this._region; }
  get creditLimit(): Money { return this._creditLimit; }
  get balance(): Money { return this._balance; }
  get version(): number { return this._version; }
  get updatedAt(): Date { return this._updatedAt; }

  updateInfo(fields: {
    name?: string;
    region?: string;
    creditLimit?: Money | number;
  }): void {
    if (fields.name !== undefined) {
      if (fields.name.trim().length === 0) throw new Error('Distributor name cannot be empty');
      this._name = fields.name;
    }
    if (fields.region !== undefined) {
      if (fields.region.trim().length === 0) throw new Error('Distributor region cannot be empty');
      this._region = fields.region;
    }
    if (fields.creditLimit !== undefined) {
      const limit = fields.creditLimit instanceof Money 
        ? fields.creditLimit 
        : Money.fromCents(fields.creditLimit);
      this._creditLimit = limit;
    }
    this._updatedAt = new Date();
  }

  charge(amount: Money | number): void {
    const chargeMoney = amount instanceof Money 
      ? amount 
      : Money.fromCents(amount, this._balance.currency);

    if (chargeMoney.isZero()) throw new Error('Charge amount must be positive');

    const nextBalance = this._balance.add(chargeMoney);
    if (nextBalance.greaterThan(this._creditLimit)) {
      throw new Error(`Transaction rejected: Credit limit exceeded. Limit: ${this._creditLimit.amount}, Projecting: ${nextBalance.amount}`);
    }

    this._balance = nextBalance;
    this._updatedAt = new Date();
  }

  receivePayment(amount: Money | number): void {
    const payMoney = amount instanceof Money 
      ? amount 
      : Money.fromCents(amount, this._balance.currency);

    if (payMoney.isZero()) throw new Error('Payment amount must be positive');

    this._balance = this._balance.subtract(payMoney);
    this._updatedAt = new Date();
  }

  incrementVersion(): void {
    this._version += 1;
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      name: this._name,
      region: this._region,
      creditLimit: this._creditLimit.cents,
      balance: this._balance.cents,
      version: this._version,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
