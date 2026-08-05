import { ProductCategory, ProductCategoryStatus } from '../../../domain/entities/product_category.js';
import { ProductCategoryPgRepository } from '../../../infrastructure/database/repositories/product_category.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export interface ListProductCategoriesQuery {
  status?: ProductCategoryStatus;
  code?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedProductCategories {
  data: ProductCategory[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class ListProductCategoriesUseCase {
  constructor(private categoryRepo: ProductCategoryPgRepository) {}

  async execute(principal: Principal, query: ListProductCategoriesQuery): Promise<PaginatedProductCategories> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'product_category:read') && !RbacGuard.can(principal, 'product_categories:read')) {
      throw new Error('Forbidden: Insufficient permissions to list product categories');
    }

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    // 2. Fetch records
    let items: ProductCategory[] = [];
    if (query.code) {
      const single = await this.categoryRepo.findByCode(principal.tenantId, query.code);
      items = single ? [single] : [];
    } else if (query.status) {
      items = await this.categoryRepo.findByStatus(principal.tenantId, query.status);
    } else {
      items = await this.categoryRepo.findAll(principal.tenantId);
    }

    if (query.status) {
      items = items.filter(c => c.status === query.status);
    }

    const total = items.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const offset = (page - 1) * pageSize;
    const paginatedData = items.slice(offset, offset + pageSize);

    return {
      data: paginatedData,
      total,
      page,
      pageSize,
      totalPages,
    };
  }
}
