import { PrimarySale, PrimarySaleStatus } from '../../../domain/entities/primary_sale.js';
import { PrimarySalePgRepository } from '../../../infrastructure/database/repositories/primary_sale.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export interface ListPrimarySalesQuery {
  status?: PrimarySaleStatus;
  distributorId?: string;
  warehouseId?: string;
  skuId?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedPrimarySales {
  data: PrimarySale[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class ListPrimarySalesUseCase {
  constructor(private saleRepo: PrimarySalePgRepository) {}

  async execute(principal: Principal, query: ListPrimarySalesQuery): Promise<PaginatedPrimarySales> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'primary_sale:read') && !RbacGuard.can(principal, 'primary_sales:read')) {
      throw new Error('Forbidden: Insufficient permissions to list primary sales');
    }

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    // 2. Fetch records
    let items = await this.saleRepo.findAll(principal.tenantId);

    if (query.status) {
      items = items.filter(s => s.status === query.status);
    }
    if (query.distributorId) {
      items = items.filter(s => s.distributorId === query.distributorId);
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
