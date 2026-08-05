import { ReturnEntity, ReturnStatus } from '../../../domain/entities/return.js';
import { ReturnPgRepository } from '../../../infrastructure/database/repositories/return.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export interface ListReturnsQuery {
  status?: ReturnStatus;
  outletId?: string;
  warehouseId?: string;
  skuId?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedReturns {
  data: ReturnEntity[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class ListReturnsUseCase {
  constructor(private returnRepo: ReturnPgRepository) {}

  async execute(principal: Principal, query: ListReturnsQuery): Promise<PaginatedReturns> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'return:read') && !RbacGuard.can(principal, 'returns:read')) {
      throw new Error('Forbidden: Insufficient permissions to list returns');
    }

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    // 2. Fetch records
    let items = await this.returnRepo.findAll(principal.tenantId);

    if (query.status) {
      items = items.filter(r => r.status === query.status);
    }
    if (query.outletId) {
      items = items.filter(r => r.outletId === query.outletId);
    }
    if (query.warehouseId) {
      items = items.filter(r => r.warehouseId === query.warehouseId);
    }
    if (query.skuId) {
      items = items.filter(r => r.skuId === query.skuId);
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
