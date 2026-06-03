export type ClaimState = 'DRAFT' | 'SUBMITTED' | 'VALIDATED' | 'SETTLED' | 'REJECTED';

export interface AccruedDetail {
  category: string; // e.g. 'SCHEME_DISCOUNT', 'DAMAGED_GOODS'
  amount: number;   // base amount in decimal format (e.g. 15000 = $150.00)
  description?: string;
}

export class ClaimAggregate {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly distributorId: string;
  
  private state: ClaimState = 'DRAFT';
  private details: AccruedDetail[] = [];
  private totalClaimAmount = 0;
  private validationNotes?: string;
  private settlementRef?: string;
  private rejectionReason?: string;

  constructor(id: string, tenantId: string, distributorId: string) {
    this.id = id;
    this.tenantId = tenantId;
    this.distributorId = distributorId;
  }

  getState(): ClaimState {
    return this.state;
  }

  getTotalAmount(): number {
    return this.totalClaimAmount;
  }

  getDetails(): AccruedDetail[] {
    return [...this.details];
  }

  getSettlementRef(): string | undefined {
    return this.settlementRef;
  }

  getRejectionReason(): string | undefined {
    return this.rejectionReason;
  }

  accrue(category: string, amount: number, description?: string): void {
    if (this.state !== 'DRAFT') {
      throw new Error(`Cannot accrue details on claim in ${this.state} state`);
    }
    if (amount <= 0) {
      throw new Error('Accrual amount must be positive');
    }

    this.details.push({ category, amount, description });
    this.totalClaimAmount += amount;
  }

  submit(): void {
    if (this.state !== 'DRAFT') {
      throw new Error(`Cannot submit claim in ${this.state} state`);
    }
    if (this.details.length === 0) {
      throw new Error('Cannot submit claim with no accrued details');
    }
    this.state = 'SUBMITTED';
  }

  validate(systemCalculatedAmount: number, tolerancePct = 5.0): void {
    if (this.state !== 'SUBMITTED') {
      throw new Error(`Cannot validate claim in ${this.state} state`);
    }

    // Check if the claimed amount is within target tolerance percentage of system calculations
    const diff = Math.abs(this.totalClaimAmount - systemCalculatedAmount);
    const maxAllowedDiff = (tolerancePct / 100) * systemCalculatedAmount;

    if (diff <= maxAllowedDiff) {
      this.state = 'VALIDATED';
      this.validationNotes = `Validated successfully within tolerance limit (diff=${diff}, maxAllowed=${maxAllowedDiff})`;
    } else {
      this.state = 'REJECTED';
      this.rejectionReason = `Claim amount ${this.totalClaimAmount} exceeds system limit ${systemCalculatedAmount} outside tolerance ${tolerancePct}%`;
    }
  }

  settle(paymentReference: string): void {
    if (this.state !== 'VALIDATED') {
      throw new Error(`Cannot settle claim in ${this.state} state`);
    }
    if (!paymentReference.trim()) {
      throw new Error('Payment reference must be provided to settle a claim');
    }

    this.settlementRef = paymentReference;
    this.state = 'SETTLED';
  }

  reject(reason: string): void {
    if (this.state === 'SETTLED' || this.state === 'REJECTED') {
      throw new Error(`Cannot reject claim in terminal state ${this.state}`);
    }
    if (!reason.trim()) {
      throw new Error('Rejection reason must be provided');
    }
    this.rejectionReason = reason;
    this.state = 'REJECTED';
  }
}
