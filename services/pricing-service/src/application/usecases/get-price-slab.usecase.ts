import { PriceSlab } from '../../domain/entities/price_slab.js';
import { PriceSlabPgRepository } from '../../infrastructure/database/repositories/price_slab.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export class GetPriceSlabUseCase {
  constructor(private slabRepo: PriceSlabPgRepository) {}

  async execute(principal: Principal, id: string): Promise<PriceSlab | null> {
    // 1. Authorize read permission
    if (!RbacGuard.can(principal, 'price_slab:read') && !RbacGuard.can(principal, 'price_slabs:read')) {
      throw new Error('Forbidden: Insufficient permissions to read price slab record');
    }

    // 2. Fetch record scoped to tenant
    const slab = await this.slabRepo.findById(principal.tenantId, id);

    // 3. Prevent cross-tenant existence leakage
    if (!slab || slab.tenantId !== principal.tenantId) {
      return null;
    }

    return slab;
  }
}
