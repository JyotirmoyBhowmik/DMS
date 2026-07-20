import { MerchandisingAuditRepository } from '../../../domain/repositories/merchandising-audit.repository.js';
import { MerchandisingAudit } from '../../../domain/entities/merchandising-audit.js';
import { RbacGuard, Principal } from '@dms/pkg-rbac';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { MerchandisingAuditPgRepository } from '../../../infrastructure/database/repositories/merchandising-audit.pg-repository.js';

export interface ListMerchandisingAuditsQuery {
  page?: number;
  pageSize?: number;
  agentId?: string;
  outletId?: string;
  status?: string;
}

export interface ListMerchandisingAuditsResponse {
  data: MerchandisingAudit[];
  page: number;
  pageSize: number;
  total: number;
}

export class ListMerchandisingAuditsUseCase {
  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: MerchandisingAuditRepository
  ) {}

  async execute(
    principal: Principal,
    tenantId: string,
    query: ListMerchandisingAuditsQuery
  ): Promise<ListMerchandisingAuditsResponse> {
    if (!principal) {
      throw new Error('Forbidden: Authentication required');
    }
    if (principal.tenantId !== tenantId) {
      throw new Error('Forbidden: Tenant context mismatch');
    }
    if (!RbacGuard.can(principal, 'merchandising_audit:read')) {
      throw new Error('Forbidden: Insufficient permissions');
    }

    const activeRepo = this.repo || new MerchandisingAuditPgRepository(this.db);
    let audits: MerchandisingAudit[] = [];

    // Filtered by agent, outlet, or find all
    if (query.agentId) {
      audits = await activeRepo.findByAgent(query.agentId, tenantId);
    } else if (query.outletId) {
      audits = await activeRepo.findByOutlet(query.outletId, tenantId);
    } else {
      audits = await activeRepo.findAll(tenantId);
    }

    // Apply additional in-memory filter (status)
    if (query.status) {
      audits = audits.filter((a) => a.status === query.status);
    }

    // Pagination
    const page = query.page && query.page > 0 ? query.page : 1;
    const rawPageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 10;
    const pageSize = Math.min(rawPageSize, 100); // hard cap at 100

    const total = audits.length;
    const startIdx = (page - 1) * pageSize;
    const paginatedData = audits.slice(startIdx, startIdx + pageSize);

    return {
      data: paginatedData,
      page,
      pageSize,
      total,
    };
  }
}
