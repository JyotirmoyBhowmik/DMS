import { Sku } from '../../../domain/entities/sku.js';
import { SkuPgRepository } from '../../../infrastructure/database/repositories/sku.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export class GetSkuUseCase {
  constructor(private skuRepo: SkuPgRepository) {}

  async execute(principal: Principal, id: string): Promise<Sku | null> {
    // 1. Authorize read permission
    if (!RbacGuard.can(principal, 'sku:read') && !RbacGuard.can(principal, 'skus:read')) {
      throw new Error('Forbidden: Insufficient permissions to read SKU');
    }

    // 2. Fetch record scoped to tenant
    const skuItem = await this.skuRepo.findById(principal.tenantId, id);

    // 3. Prevent cross-tenant existence leakage
    if (!skuItem || skuItem.tenantId !== principal.tenantId) {
      return null;
    }

    return skuItem;
  }
}
