import { CreditLimit, CreditRating } from '../../../domain/entities/credit-limit.js';
import { CreditLimitPgRepository } from '../../../infrastructure/database/repositories/credit-limit.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
export interface ListCreditLimitsQuery {
  distributorId?: string;
  creditRating?: CreditRating;
  onCreditHold?: boolean;
  page?: number;
  pageSize?: number;
}

export interface PaginatedCreditLimits {
  data: CreditLimit[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class ListCreditLimitsUseCase {
  constructor(private creditLimitRepo: CreditLimitPgRepository) {}

  async execute(principal: Principal, query: ListCreditLimitsQuery): Promise<PaginatedCreditLimits> {

    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'credit_limit:read') && !RbacGuard.can(principal, 'credit-limits:read')) {
      throw new Error('Forbidden: Insufficient permissions to list credit limits');
    }

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    // 2. Fetch items based on filter parameters
    let items: CreditLimit[] = [];
    if (query.distributorId) {
      const single = await this.creditLimitRepo.findByDistributor(principal.tenantId, query.distributorId);
      items = single ? [single] : [];
    } else if (query.creditRating) {
      items = await this.creditLimitRepo.findByRating(principal.tenantId, query.creditRating as CreditRating);
    } else if (query.onCreditHold) {
      items = await this.creditLimitRepo.findOnCreditHold(principal.tenantId);
    } else {
      items = await this.creditLimitRepo.findAll(principal.tenantId);
    }

    if (query.onCreditHold !== undefined) {
      items = items.filter(cl => cl.isOnCreditHold === query.onCreditHold);
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
