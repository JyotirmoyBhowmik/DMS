import { Product } from '../../../domain/entities/product.js';
import { ProductPgRepository } from '../../../infrastructure/database/repositories/product.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export class GetProductUseCase {
  constructor(private productRepo: ProductPgRepository) {}

  async execute(principal: Principal, id: string): Promise<Product | null> {
    // 1. Authorize read permission
    if (!RbacGuard.can(principal, 'product:read') && !RbacGuard.can(principal, 'products:read')) {
      throw new Error('Forbidden: Insufficient permissions to read product');
    }

    // 2. Fetch record scoped to tenant
    const product = await this.productRepo.findById(principal.tenantId, id);

    // 3. Prevent cross-tenant existence leakage
    if (!product || product.tenantId !== principal.tenantId) {
      return null;
    }

    return product;
  }
}
