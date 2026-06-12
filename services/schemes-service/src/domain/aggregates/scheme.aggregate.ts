import { SchemeEntity, SchemeStatus } from '../entities/scheme.entity.js';

export class SchemeAggregate {
  private scheme: SchemeEntity;

  constructor(scheme: SchemeEntity) {
    this.scheme = scheme;
  }

  getScheme(): SchemeEntity {
    return this.scheme;
  }

  validateInvariants(): void {
    if (!this.scheme.name.trim()) {
      throw new Error('Scheme aggregate invariant failed: name must not be empty');
    }
    if (!this.scheme.tenantId) {
      throw new Error('Scheme aggregate invariant failed: tenantId is required');
    }
    if (this.scheme.endDate && this.scheme.startDate > this.scheme.endDate) {
      throw new Error('Scheme aggregate invariant failed: startDate must be before or equal to endDate');
    }
    if (this.scheme.payouts.discountPercentage !== undefined) {
      const pct = this.scheme.payouts.discountPercentage;
      if (pct < 0 || pct > 100) {
        throw new Error('Scheme aggregate invariant failed: discountPercentage must be between 0 and 100');
      }
    }
    if (this.scheme.payouts.flatDiscountAmount !== undefined) {
      if (this.scheme.payouts.flatDiscountAmount < 0) {
        throw new Error('Scheme aggregate invariant failed: flatDiscountAmount must be non-negative');
      }
    }
  }

  activate(): void {
    this.validateInvariants();
    if (this.scheme.status === 'expired') {
      throw new Error('Cannot activate an expired scheme');
    }
    this.scheme.status = 'active';
  }

  suspend(): void {
    if (this.scheme.status !== 'active') {
      throw new Error('Cannot suspend a scheme that is not active');
    }
    this.scheme.status = 'suspended';
  }

  expire(): void {
    this.scheme.status = 'expired';
  }

  /**
   * Evaluates if a given order matches this scheme's eligibility rules
   */
  isEligible(orderAmount: number, itemSkuIds: string[]): boolean {
    if (this.scheme.status !== 'active') {
      return false;
    }
    const now = new Date();
    if (now < this.scheme.startDate) return false;
    if (this.scheme.endDate && now > this.scheme.endDate) return false;

    // Check min order amount rule
    if (this.scheme.rules.minOrderAmount !== undefined) {
      if (orderAmount < this.scheme.rules.minOrderAmount) {
        return false;
      }
    }

    // Check applicable SKUs rule
    if (this.scheme.rules.applicableSkuIds && this.scheme.rules.applicableSkuIds.length > 0) {
      const hasMatchingSku = itemSkuIds.some(sku => 
        this.scheme.rules.applicableSkuIds!.includes(sku)
      );
      if (!hasMatchingSku) {
        return false;
      }
    }

    return true;
  }
}
