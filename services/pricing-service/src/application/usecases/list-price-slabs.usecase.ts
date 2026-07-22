import { PriceSlab, PriceSlabStatus } from '../../domain/entities/price_slab.js';
import { PriceSlabPgRepository } from '../../infrastructure/database/repositories/price_slab.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export interface ListPriceSlabsQuery {
  status?: PriceSlabStatus;
  priceListId?: string;
  skuId?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedPriceSlabs {
  data: PriceSlab[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class ListPriceSlabsUseCase {
  constructor(private slabRepo: PriceSlabPgRepository) {}

  async execute(principal: Principal, query: ListPriceSlabsQuery): Promise<PaginatedPriceSlabs> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'price_slab:read') && !RbacGuard.can(principal, 'price_slabs:read')) {
      throw new Error('Forbidden: Insufficient permissions to list price slabs');
    }

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    // 2. Fetch records
    let items = await this.slabRepo.findAll(principal.tenantId);

    if (query.status) {
      items = items.filter(s => s.status === query.status);
    }
    if (query.priceListId) {
      items = items.filter(s => s.priceListId === query.priceListId);
    }
    if (query.skuId) {
      items = items.filter(s => s.skuId === query.skuId);
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
