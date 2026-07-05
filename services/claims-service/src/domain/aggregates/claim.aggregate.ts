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
    if (this.claim.amount <= 0) {
      throw new Error('Claim aggregate invariant failed: amount must be greater than zero');
    }
    if (this.claim.settledAmount < 0) {
      throw new Error('Claim aggregate invariant failed: settledAmount must be non-negative');
    }
    if (this.claim.settledAmount > this.claim.amount) {
      throw new Error('Claim aggregate invariant failed: settledAmount cannot exceed claim amount');
    }
  }

  raise(): void {
    this.claim.status = 'raised';
    this.validateInvariants();
  }

  validate(): void {
    if (this.claim.status !== 'raised') {
      throw new Error(`Cannot validate claim in status: ${this.claim.status}`);
    }
    this.claim.status = 'validated';
    this.validateInvariants();
  }

  approve(): void {
    if (this.claim.status !== 'validated') {
      throw new Error(`Cannot approve claim in status: ${this.claim.status}`);
    }
    this.claim.status = 'approved';
    this.validateInvariants();
  }

  reject(): void {
    if (this.claim.status !== 'raised' && this.claim.status !== 'validated') {
      throw new Error(`Cannot reject claim in status: ${this.claim.status}`);
    }
    this.claim.status = 'rejected';
    this.validateInvariants();
  }

  settle(amount: number): void {
    if (this.claim.status !== 'approved' && this.claim.status !== 'settled') {
      throw new Error(`Cannot settle claim in status: ${this.claim.status}`);
    }
    if (amount <= 0) {
      throw new Error('Settlement amount must be greater than zero');
    }
    
    const newSettledAmount = this.claim.settledAmount + amount;
    if (newSettledAmount > this.claim.amount) {
      throw new Error(`Over-claim detected: cannot settle ${amount} because total settled (${newSettledAmount}) would exceed claim amount (${this.claim.amount})`);
    }

    this.claim.settledAmount = newSettledAmount;
    this.claim.status = 'settled';
    this.validateInvariants();
  }
}
