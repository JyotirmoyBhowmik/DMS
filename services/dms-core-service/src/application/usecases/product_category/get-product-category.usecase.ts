import { ProductCategory } from '../../../domain/entities/product_category.js';
import { ProductCategoryPgRepository } from '../../../infrastructure/database/repositories/product_category.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export class GetProductCategoryUseCase {
  constructor(private categoryRepo: ProductCategoryPgRepository) {}

  async execute(principal: Principal, id: string): Promise<ProductCategory | null> {
    // 1. Authorize read permission
    if (!RbacGuard.can(principal, 'product_category:read') && !RbacGuard.can(principal, 'product_categories:read')) {
      throw new Error('Forbidden: Insufficient permissions to read product category');
    }

    // 2. Fetch record scoped to tenant
    const category = await this.categoryRepo.findById(principal.tenantId, id);

    // 3. Prevent cross-tenant existence leakage
    if (!category || category.tenantId !== principal.tenantId) {
      return null;
    }

    return category;
  }
}
