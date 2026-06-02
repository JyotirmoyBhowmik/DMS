/**
 * Distributor Domain Entity.
 * Represents wholesale account profile with credit limits.
 */
export class Distributor {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly name: string;
  public readonly region: string;
  public readonly creditLimit: number;
  private _balance: number;

  constructor(id: string, tenantId: string, name: string, region: string, creditLimit: number, balance: number) {
    this.id = id;
    this.tenantId = tenantId;
    this.name = name;
    this.region = region;
    this.creditLimit = creditLimit;
    this._balance = balance;
  }

  get balance(): number {
    return this._balance;
  }

  static create(props: {
    id: string;
    tenantId: string;
    name: string;
    region: string;
    creditLimit: number;
    balance?: number;
  }): Distributor {
    return new Distributor(
      props.id,
      props.tenantId,
      props.name,
      props.region,
      props.creditLimit,
      props.balance ?? 0
    );
  }

  charge(amount: number): void {
    if (amount <= 0) throw new Error('Charge amount must be positive');
    if (this._balance + amount > this.creditLimit) {
      throw new Error(`Transaction rejected: Credit limit exceeded. Limit: ${this.creditLimit}, Projecting: ${this._balance + amount}`);
    }
    this._balance += amount;
  }

  receivePayment(amount: number): void {
    if (amount <= 0) throw new Error('Payment amount must be positive');
    this._balance -= amount;
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      name: this.name,
      region: this.region,
      creditLimit: this.creditLimit,
      balance: this._balance,
    };
  }
}
