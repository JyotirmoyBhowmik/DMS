import { TertiarySale, TertiarySaleStatus } from '../../../domain/entities/tertiary_sale.js';
import { TertiarySalePgRepository } from '../../../infrastructure/database/repositories/tertiary_sale.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export interface ListTertiarySalesQuery {
  status?: TertiarySaleStatus;
  consumerId?: string;
  outletId?: string;
  skuId?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedTertiarySales {
  data: TertiarySale[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class ListTertiarySalesUseCase {
  constructor(private saleRepo: TertiarySalePgRepository) {}

  async execute(principal: Principal, query: ListTertiarySalesQuery): Promise<PaginatedTertiarySales> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'tertiary_sale:read') && !RbacGuard.can(principal, 'tertiary_sales:read')) {
      throw new Error('Forbidden: Insufficient permissions to list tertiary sales');
    }

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    // 2. Fetch records
    let items = await this.saleRepo.findAll(principal.tenantId);

    if (query.status) {
      items = items.filter(s => s.status === query.status);
    }
    if (query.consumerId) {
      items = items.filter(s => s.consumerId === query.consumerId);
    }
    if (query.outletId) {
      items = items.filter(s => s.outletId === query.outletId);
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
