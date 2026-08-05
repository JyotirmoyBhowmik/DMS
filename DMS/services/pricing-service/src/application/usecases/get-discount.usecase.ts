import { Discount } from '../../domain/entities/discount.js';
import { DiscountPgRepository } from '../../infrastructure/database/repositories/discount.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export class GetDiscountUseCase {
  constructor(private discountRepo: DiscountPgRepository) {}

  async execute(principal: Principal, id: string): Promise<Discount | null> {
    // 1. Authorize read permission
    if (!RbacGuard.can(principal, 'discount:read') && !RbacGuard.can(principal, 'discounts:read')) {
      throw new Error('Forbidden: Insufficient permissions to read discount record');
    }

    // 2. Fetch record scoped to tenant
    const discount = await this.discountRepo.findById(principal.tenantId, id);

    // 3. Prevent cross-tenant existence leakage
    if (!discount || discount.tenantId !== principal.tenantId) {
      return null;
    }

    return discount;
  }
}
