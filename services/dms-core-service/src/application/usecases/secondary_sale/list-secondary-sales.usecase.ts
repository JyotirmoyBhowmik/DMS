import { SecondarySale, SecondarySaleStatus } from '../../../domain/entities/secondary_sale.js';
import { SecondarySalePgRepository } from '../../../infrastructure/database/repositories/secondary_sale.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export interface ListSecondarySalesQuery {
  status?: SecondarySaleStatus;
  outletId?: string;
  warehouseId?: string;
  skuId?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedSecondarySales {
  data: SecondarySale[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class ListSecondarySalesUseCase {
  constructor(private saleRepo: SecondarySalePgRepository) {}

  async execute(principal: Principal, query: ListSecondarySalesQuery): Promise<PaginatedSecondarySales> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'secondary_sale:read') && !RbacGuard.can(principal, 'secondary_sales:read')) {
      throw new Error('Forbidden: Insufficient permissions to list secondary sales');
    }

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    // 2. Fetch records
    let items = await this.saleRepo.findAll(principal.tenantId);

    if (query.status) {
      items = items.filter(s => s.status === query.status);
    }
    if (query.outletId) {
      items = items.filter(s => s.outletId === query.outletId);
    }
    if (query.warehouseId) {
      items = items.filter(s => s.warehouseId === query.warehouseId);
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
