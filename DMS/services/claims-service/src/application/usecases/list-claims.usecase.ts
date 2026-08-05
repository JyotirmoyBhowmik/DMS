import { Claim, ClaimStatus } from '../../domain/entities/claim.js';
import { ClaimPgRepository } from '../../infrastructure/database/repositories/claim.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export interface ListClaimsQuery {
  status?: ClaimStatus;
  distributorId?: string;
  schemeId?: string;
  claimCode?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedClaims {
  data: Claim[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class ListClaimsUseCase {
  constructor(private claimRepo: ClaimPgRepository) {}

  async execute(principal: Principal, query: ListClaimsQuery): Promise<PaginatedClaims> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'claim:read') && !RbacGuard.can(principal, 'claims:read')) {
      throw new Error('Forbidden: Insufficient permissions to list claims');
    }

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    // 2. Fetch records
    let items = await this.claimRepo.findAll(principal.tenantId);

    if (query.status) {
      items = items.filter(c => c.status === query.status);
    }
    if (query.distributorId) {
      items = items.filter(c => c.distributorId === query.distributorId);
    }
    if (query.schemeId) {
      items = items.filter(c => c.schemeId === query.schemeId);
    }
    if (query.claimCode) {
      items = items.filter(c => c.claimCode === query.claimCode);
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
