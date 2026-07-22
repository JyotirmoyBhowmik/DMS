import { Replacement, ReplacementStatus } from '../../../domain/entities/replacement.js';
import { ReplacementPgRepository } from '../../../infrastructure/database/repositories/replacement.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export interface ListReplacementsQuery {
  status?: ReplacementStatus;
  returnId?: string;
  outletId?: string;
  warehouseId?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedReplacements {
  data: Replacement[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class ListReplacementsUseCase {
  constructor(private repRepo: ReplacementPgRepository) {}

  async execute(principal: Principal, query: ListReplacementsQuery): Promise<PaginatedReplacements> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'replacement:read') && !RbacGuard.can(principal, 'replacements:read')) {
      throw new Error('Forbidden: Insufficient permissions to list replacements');
    }

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    // 2. Fetch records
    let items = await this.repRepo.findAll(principal.tenantId);

    if (query.status) {
      items = items.filter(r => r.status === query.status);
    }
    if (query.returnId) {
      items = items.filter(r => r.returnId === query.returnId);
    }
    if (query.outletId) {
      items = items.filter(r => r.outletId === query.outletId);
    }
    if (query.warehouseId) {
      items = items.filter(r => r.warehouseId === query.warehouseId);
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
