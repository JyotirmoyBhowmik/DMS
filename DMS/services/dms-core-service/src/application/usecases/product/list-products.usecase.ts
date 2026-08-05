import { Product, ProductStatus } from '../../../domain/entities/product.js';
import { ProductPgRepository } from '../../../infrastructure/database/repositories/product.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export interface ListProductsQuery {
  category?: string;
  status?: ProductStatus;
  sku?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedProducts {
  data: Product[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class ListProductsUseCase {
  constructor(private productRepo: ProductPgRepository) {}

  async execute(principal: Principal, query: ListProductsQuery): Promise<PaginatedProducts> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'product:read') && !RbacGuard.can(principal, 'products:read')) {
      throw new Error('Forbidden: Insufficient permissions to list products');
    }

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    // 2. Fetch records
    let items: Product[] = [];
    if (query.sku) {
      const single = await this.productRepo.findBySku(principal.tenantId, query.sku);
      items = single ? [single] : [];
    } else if (query.category) {
      items = await this.productRepo.findByCategory(principal.tenantId, query.category);
    } else if (query.status) {
      items = await this.productRepo.findByStatus(principal.tenantId, query.status);
    } else {
      items = await this.productRepo.findAll(principal.tenantId);
    }

    if (query.status) {
      items = items.filter(p => p.status === query.status);
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
