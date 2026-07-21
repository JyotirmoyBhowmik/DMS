/**
 * Immutable Money value object.
 * All arithmetic returns new instances. Validates non-negative on construction.
 * Uses integer-based cent arithmetic internally to avoid floating point drift.
 */
export class Money {
  private readonly _cents: number;
  public readonly currency: string;

  private constructor(cents: number, currency: string) {
    if (cents < 0) {
      throw new Error(`Money amount cannot be negative: ${cents / 100}`);
    }
    this._cents = Math.round(cents);
    this.currency = currency;
  }

  /** Create Money from a decimal amount (e.g. 12.50). */
  static of(amount: number, currency = 'INR'): Money {
    return new Money(Math.round(amount * 100), currency);
  }

  /** Create Money from raw cent value. */
  static fromCents(cents: number, currency = 'INR'): Money {
    return new Money(cents, currency);
  }

  /** Zero-value Money for a given currency. */
  static zero(currency = 'INR'): Money {
    return new Money(0, currency);
  }

  get amount(): number {
    return this._cents / 100;
  }

  get cents(): number {
    return this._cents;
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this._cents + other._cents, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    const result = this._cents - other._cents;
    if (result < 0) {
      throw new Error(
        `Subtraction would result in negative money: ${this.amount} - ${other.amount}`,
      );
    }
    return new Money(result, this.currency);
  }

  multiply(factor: number): Money {
    return new Money(Math.round(this._cents * factor), this.currency);
  }

  equals(other: Money): boolean {
    return this._cents === other._cents && this.currency === other.currency;
  }

  isZero(): boolean {
    return this._cents === 0;
  }

  greaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this._cents > other._cents;
  }

  lessThanOrEqual(other: Money): boolean {
    this.assertSameCurrency(other);
    return this._cents <= other._cents;
  }

  /** Formatted display: ₹1,234.56 */
  formatted(): string {
    const symbol = this.currency === 'INR' ? '₹' : this.currency;
    const formatted = this.amount.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${symbol}${formatted}`;
  }

  toString(): string {
    return `${this.amount} ${this.currency}`;
  }

  toJSON(): { amount: number; currency: string } {
    return { amount: this.amount, currency: this.currency };
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(
        `Currency mismatch: cannot operate on ${this.currency} and ${other.currency}`,
      );
    }
  }
}
