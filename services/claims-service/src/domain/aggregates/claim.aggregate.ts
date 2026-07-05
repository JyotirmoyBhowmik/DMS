import { ClaimEntity } from '../entities/claim.entity.js';

export class ClaimAggregate {
  private claim: ClaimEntity;

  constructor(claim: ClaimEntity) {
    this.claim = claim;
  }

  getClaim(): ClaimEntity {
    return this.claim;
  }

  validateInvariants(): void {
    if (!this.claim.tenantId) {
      throw new Error('Claim aggregate invariant failed: tenantId is required');
    }
    if (!this.claim.distributorId) {
      throw new Error('Claim aggregate invariant failed: distributorId is required');
    }
    if (!this.claim.schemeId) {
      throw new Error('Claim aggregate invariant failed: schemeId is required');
    }
    
    const amt = this.claim.claimAmount !== undefined ? this.claim.claimAmount : this.claim.amount;
    if (amt <= 0) {
      throw new Error('Claim amount must be greater than zero');
    }
    
    if (this.claim.calculations && this.claim.calculations.taxAmount < 0) {
      throw new Error('Tax amount cannot be negative');
    }

    if (this.claim.settledAmount < 0) {
      throw new Error('Claim aggregate invariant failed: settledAmount must be non-negative');
    }
  }

  raise(): void {
    this.claim.status = 'raised';
    this.validateInvariants();
  }

  validate(validatorUser?: string): void {
    if (this.claim.status !== 'raised' && this.claim.status !== 'draft') {
      throw new Error(`Cannot validate claim in status: ${this.claim.status}`);
    }
    this.claim.status = 'validated';
    this.claim.validatedBy = validatorUser;
    this.claim.validatedAt = new Date();
    this.validateInvariants();
  }

  approve(approverUser?: string): void {
    if (this.claim.status !== 'validated') {
      throw new Error(`Cannot approve claim in status: ${this.claim.status}`);
    }
    this.claim.status = 'approved';
    this.claim.approvedBy = approverUser;
    this.validateInvariants();
  }

  reject(rejecterUser?: string, reason?: string): void {
    if (this.claim.status !== 'raised' && this.claim.status !== 'validated') {
      throw new Error(`Cannot reject claim in status: ${this.claim.status}`);
    }
    this.claim.status = 'rejected';
    this.claim.rejectionReason = reason;
    this.validateInvariants();
  }

  settle(idempotencyKey: string, amount: number): void {
    if (this.claim.status !== 'approved' && this.claim.status !== 'settled') {
      throw new Error(`Cannot settle claim in status: ${this.claim.status}`);
    }
    if (amount <= 0) {
      throw new Error('Settlement amount must be greater than zero');
    }
    
    const amt = this.claim.calculations?.netAmount || this.claim.claimAmount || this.claim.amount;
    const newSettledAmount = this.claim.settledAmount + amount;
    
    // We check if it is over-claimed
    if (newSettledAmount > amt && (this.claim.status !== 'settled' || newSettledAmount > amt)) {
      throw new Error(`Over-claim detected: cannot settle ${amount} because total settled (${newSettledAmount}) would exceed claim amount (${amt})`);
    }

    this.claim.settledAmount = newSettledAmount;
    this.claim.status = 'settled';
    this.claim.settlementDetails = {
      status: 'COMPLETED',
      amountPaid: amount,
      idempotencyKey,
    };
    this.validateInvariants();
  }
}
