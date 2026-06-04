/**
 * CreditLimit Domain Entity.
 * Manages distributor credit limits, utilization, temporary increases, and review cycles.
 * All monetary values in BIGINT (paise/cents).
 */

export type CreditRating = 'A' | 'B' | 'C' | 'D';

export interface CreditLimitProps {
  id: string;
  tenantId: string;
  distributorId: string;
  creditLimit: number;
  utilizedAmount?: number;
  temporaryLimitIncrease?: number;
  temporaryLimitExpiry?: string;
  lastReviewDate?: string;
  nextReviewDate?: string;
  creditRating?: CreditRating;
  paymentTermDays?: number;
  version?: number;
}

export class CreditLimit {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly distributorId: string;
  private _creditLimit: number;
  private _utilizedAmount: number;
  private _temporaryLimitIncrease: number;
  private _temporaryLimitExpiry?: string;
  private _lastReviewDate?: string;
  private _nextReviewDate?: string;
  private _creditRating: CreditRating;
  private _paymentTermDays: number;
  private _version: number;

  constructor(props: CreditLimitProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.distributorId = props.distributorId;
    this._creditLimit = props.creditLimit;
    this._utilizedAmount = props.utilizedAmount ?? 0;
    this._temporaryLimitIncrease = props.temporaryLimitIncrease ?? 0;
    this._temporaryLimitExpiry = props.temporaryLimitExpiry;
    this._lastReviewDate = props.lastReviewDate;
    this._nextReviewDate = props.nextReviewDate;
    this._creditRating = props.creditRating ?? 'C';
    this._paymentTermDays = props.paymentTermDays ?? 30;
    this._version = props.version ?? 1;
  }

  get creditLimit(): number { return this._creditLimit; }
  get utilizedAmount(): number { return this._utilizedAmount; }
  get temporaryLimitIncrease(): number { return this._temporaryLimitIncrease; }
  get temporaryLimitExpiry(): string | undefined { return this._temporaryLimitExpiry; }
  get lastReviewDate(): string | undefined { return this._lastReviewDate; }
  get nextReviewDate(): string | undefined { return this._nextReviewDate; }
  get creditRating(): CreditRating { return this._creditRating; }
  get paymentTermDays(): number { return this._paymentTermDays; }
  get version(): number { return this._version; }

  /**
   * Computes available credit = limit + active temp increase - utilized.
   */
  get availableAmount(): number {
    const activeTempIncrease = this.isTemporaryLimitActive() ? this._temporaryLimitIncrease : 0;
    return this._creditLimit + activeTempIncrease - this._utilizedAmount;
  }

  /**
   * Utilization percentage: utilized / (limit + temp increase) * 100
   */
  get utilizationPercentage(): number {
    const effectiveLimit = this._creditLimit + (this.isTemporaryLimitActive() ? this._temporaryLimitIncrease : 0);
    if (effectiveLimit === 0) return 0;
    return Math.round((this._utilizedAmount / effectiveLimit) * 10000) / 100;
  }

  /**
   * Business rule: auto-hold if utilization > 90%
   */
  get isOnCreditHold(): boolean {
    return this.utilizationPercentage > 90;
  }

  /**
   * Business rule: check if review is due
   */
  get isReviewDue(): boolean {
    if (!this._nextReviewDate) return false;
    return new Date(this._nextReviewDate).getTime() <= Date.now();
  }

  static create(props: CreditLimitProps): CreditLimit {
    if (props.creditLimit < 0) {
      throw new Error('Credit limit must be non-negative');
    }
    return new CreditLimit(props);
  }

  utilize(amount: number): void {
    if (amount <= 0) throw new Error('Utilization amount must be positive');
    if (amount > this.availableAmount) {
      throw new Error(`Insufficient credit. Available: ${this.availableAmount}, Requested: ${amount}`);
    }
    this._utilizedAmount += amount;
    this._version++;
  }

  releaseUtilization(amount: number): void {
    if (amount <= 0) throw new Error('Release amount must be positive');
    if (amount > this._utilizedAmount) {
      throw new Error(`Cannot release more than utilized. Utilized: ${this._utilizedAmount}, Releasing: ${amount}`);
    }
    this._utilizedAmount -= amount;
    this._version++;
  }

  setTemporaryIncrease(amount: number, expiryDate: string): void {
    if (amount <= 0) throw new Error('Temporary increase must be positive');
    this._temporaryLimitIncrease = amount;
    this._temporaryLimitExpiry = expiryDate;
    this._version++;
  }

  clearTemporaryIncrease(): void {
    this._temporaryLimitIncrease = 0;
    this._temporaryLimitExpiry = undefined;
    this._version++;
  }

  updateCreditRating(rating: CreditRating): void {
    this._creditRating = rating;
    this._lastReviewDate = new Date().toISOString().split('T')[0];
    this._version++;
  }

  updatePaymentTerms(days: number): void {
    if (days <= 0) throw new Error('Payment term days must be positive');
    this._paymentTermDays = days;
    this._version++;
  }

  scheduleNextReview(date: string): void {
    this._nextReviewDate = date;
    this._version++;
  }

  updateLimit(newLimit: number): void {
    if (newLimit < 0) throw new Error('Credit limit must be non-negative');
    this._creditLimit = newLimit;
    this._version++;
  }

  private isTemporaryLimitActive(): boolean {
    if (this._temporaryLimitIncrease <= 0 || !this._temporaryLimitExpiry) return false;
    return new Date(this._temporaryLimitExpiry).getTime() > Date.now();
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      distributorId: this.distributorId,
      creditLimit: this._creditLimit,
      utilizedAmount: this._utilizedAmount,
      availableAmount: this.availableAmount,
      temporaryLimitIncrease: this._temporaryLimitIncrease,
      temporaryLimitExpiry: this._temporaryLimitExpiry,
      lastReviewDate: this._lastReviewDate,
      nextReviewDate: this._nextReviewDate,
      creditRating: this._creditRating,
      paymentTermDays: this._paymentTermDays,
      isOnCreditHold: this.isOnCreditHold,
      utilizationPercentage: this.utilizationPercentage,
      version: this._version,
    };
  }
}
