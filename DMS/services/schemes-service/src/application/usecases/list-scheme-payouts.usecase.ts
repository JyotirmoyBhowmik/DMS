import { SchemePayout, SchemePayoutStatus, PayoutType } from '../../domain/entities/scheme_payout.js';
import { SchemePayoutPgRepository } from '../../infrastructure/database/repositories/scheme_payout.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export interface ListSchemePayoutsQuery {
  status?: SchemePayoutStatus;
  schemeId?: string;
  distributorId?: string;
  payoutCode?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedSchemePayouts {
  data: SchemePayout[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class ListSchemePayoutsUseCase {
  constructor(private payoutRepo: SchemePayoutPgRepository) {}

  async execute(principal: Principal, query: ListSchemePayoutsQuery): Promise<PaginatedSchemePayouts> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'scheme_payout:read') && !RbacGuard.can(principal, 'scheme_payouts:read')) {
      throw new Error('Forbidden: Insufficient permissions to list scheme payouts');
    }

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    // 2. Fetch records
    let items = await this.payoutRepo.findAll(principal.tenantId);

    if (query.status) {
      items = items.filter(p => p.status === query.status);
    }
    if (query.schemeId) {
      items = items.filter(p => p.schemeId === query.schemeId);
    }
    if (query.distributorId) {
      items = items.filter(p => p.distributorId === query.distributorId);
    }
    if (query.payoutCode) {
      items = items.filter(p => p.payoutCode === query.payoutCode);
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
