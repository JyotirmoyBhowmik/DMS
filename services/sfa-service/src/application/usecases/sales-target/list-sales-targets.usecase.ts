import { SalesTargetRepository } from '../../../domain/repositories/sales-target.repository.js';
import { SalesTarget } from '../../../domain/entities/sales-target.js';
import { RbacGuard, Principal } from '@dms/pkg-rbac';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { SalesTargetPgRepository } from '../../../infrastructure/database/repositories/sales-target.pg-repository.js';

export interface ListSalesTargetsQuery {
  page?: number;
  pageSize?: number;
  agentId?: string;
  status?: string;
  targetType?: string;
}

export class ListSalesTargetsUseCase {
  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: SalesTargetRepository
  ) {}

  async execute(
    principal: Principal,
    tenantId: string,
    query: ListSalesTargetsQuery
  ): Promise<{ items: SalesTarget[]; total: number; page: number; pageSize: number }> {
    if (!principal) {
      throw new Error('Forbidden: Authentication required');
    }
    if (principal.tenantId !== tenantId) {
      throw new Error('Forbidden: Tenant context mismatch');
    }
    if (!RbacGuard.can(principal, 'sales_target:read') && !RbacGuard.can(principal, 'sales-targets:read')) {
      throw new Error('Forbidden: Insufficient permissions to view sales targets');
    }

    const activeRepo = this.repo || new SalesTargetPgRepository(this.db);

    const page = Math.max(1, query.page || 1);
    const rawPageSize = query.pageSize || 10;
    const pageSize = Math.min(100, Math.max(1, rawPageSize)); // Mandatory pagination cap

    const offset = (page - 1) * pageSize;

    let targets = await activeRepo.findAll(tenantId, 1000, 0);

    // Filter rules
    if (query.agentId) {
      targets = targets.filter((c) => c.agentId === query.agentId);
    }
    if (query.status) {
      targets = targets.filter((c) => c.status === query.status);
    }
    if (query.targetType) {
      targets = targets.filter((c) => c.targetType === query.targetType);
    }

    // Agent can only see their own sales targets
    if (principal.roles.includes('agent')) {
      targets = targets.filter((c) => c.agentId === principal.id);
    }

    const total = targets.length;
    const pagedItems = targets.slice(offset, offset + pageSize);

    return {
      items: pagedItems,
      total,
      page,
      pageSize,
    };
  }
}
