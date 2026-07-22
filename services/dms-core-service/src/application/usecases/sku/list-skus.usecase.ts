import { Sku, SkuStatus } from '../../../domain/entities/sku.js';
import { SkuPgRepository } from '../../../infrastructure/database/repositories/sku.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export interface ListSkusQuery {
  status?: SkuStatus;
  code?: string;
  productId?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedSkus {
  data: Sku[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class ListSkusUseCase {
  constructor(private skuRepo: SkuPgRepository) {}

  async execute(principal: Principal, query: ListSkusQuery): Promise<PaginatedSkus> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'sku:read') && !RbacGuard.can(principal, 'skus:read')) {
      throw new Error('Forbidden: Insufficient permissions to list SKUs');
    }

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    // 2. Fetch records
    let items: Sku[] = [];
    if (query.code) {
      const single = await this.skuRepo.findByCode(principal.tenantId, query.code);
      items = single ? [single] : [];
    } else if (query.status) {
      items = await this.skuRepo.findByStatus(principal.tenantId, query.status);
    } else {
      items = await this.skuRepo.findAll(principal.tenantId);
    }

    if (query.productId) {
      items = items.filter(s => s.productId === query.productId);
    }
    if (query.status) {
      items = items.filter(s => s.status === query.status);
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
