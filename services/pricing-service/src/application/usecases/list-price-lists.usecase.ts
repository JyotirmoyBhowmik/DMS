import { PriceList, PriceListStatus } from '../../domain/entities/price_list.js';
import { PriceListPgRepository } from '../../infrastructure/database/repositories/price_list.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export interface ListPriceListsQuery {
  status?: PriceListStatus;
  code?: string;
  currency?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedPriceLists {
  data: PriceList[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class ListPriceListsUseCase {
  constructor(private listRepo: PriceListPgRepository) {}

  async execute(principal: Principal, query: ListPriceListsQuery): Promise<PaginatedPriceLists> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'price_list:read') && !RbacGuard.can(principal, 'price_lists:read')) {
      throw new Error('Forbidden: Insufficient permissions to list price lists');
    }

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    // 2. Fetch records
    let items = await this.listRepo.findAll(principal.tenantId);

    if (query.status) {
      items = items.filter(l => l.status === query.status);
    }
    if (query.code) {
      items = items.filter(l => l.code === query.code);
    }
    if (query.currency) {
      items = items.filter(l => l.currency === query.currency);
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
