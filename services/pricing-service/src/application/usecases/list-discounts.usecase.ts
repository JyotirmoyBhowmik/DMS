import { Discount, DiscountStatus, DiscountType } from '../../domain/entities/discount.js';
import { DiscountPgRepository } from '../../infrastructure/database/repositories/discount.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export interface ListDiscountsQuery {
  status?: DiscountStatus;
  discountType?: DiscountType;
  code?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedDiscounts {
  data: Discount[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class ListDiscountsUseCase {
  constructor(private discountRepo: DiscountPgRepository) {}

  async execute(principal: Principal, query: ListDiscountsQuery): Promise<PaginatedDiscounts> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'discount:read') && !RbacGuard.can(principal, 'discounts:read')) {
      throw new Error('Forbidden: Insufficient permissions to list discounts');
    }

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    // 2. Fetch records
    let items = await this.discountRepo.findAll(principal.tenantId);

    if (query.status) {
      items = items.filter(d => d.status === query.status);
    }
    if (query.discountType) {
      items = items.filter(d => d.discountType === query.discountType);
    }
    if (query.code) {
      items = items.filter(d => d.code === query.code);
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
