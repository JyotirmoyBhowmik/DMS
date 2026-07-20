import { StructuredLogger } from '@dms/pkg-logger';
import { VanSale } from '../../../domain/entities/van-sale.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { VanSalePgRepository } from '../../../infrastructure/database/repositories/van-sale.pg-repository.js';
import { RbacGuard, Principal } from '@dms/pkg-rbac';

export class ListVanSalesUseCase {
  private logger = new StructuredLogger('ListVanSalesUseCase');

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: VanSalePgRepository,
  ) {}

  async execute(
    principal: Principal,
    tenantId: string,
    query: {
      agentId?: string;
      status?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ): Promise<{ data: VanSale[]; total: number; page: number; pageSize: number }> {
    this.logger.info('Executing ListVanSalesUseCase', { tenantId, query });

    // 1. Enforce RBAC + Tenant isolation
    if (!principal) {
      throw new Error('Forbidden: Authentication required');
    }
    if (principal.tenantId !== tenantId) {
      throw new Error('Forbidden: Tenant context mismatch');
    }
    if (!RbacGuard.can(principal, 'van_sale:read')) {
      throw new Error('Forbidden: Insufficient permissions');
    }

    const activeRepo = this.repo || new VanSalePgRepository(this.db);
    let sessions = await activeRepo.findAll(tenantId);

    // Apply filtering
    if (query.agentId) {
      sessions = sessions.filter(s => s.agentId === query.agentId);
    }
    if (query.status) {
      sessions = sessions.filter(s => s.status === query.status);
    }

    const total = sessions.length;
    const page = query.page || 1;
    const pageSize = Math.min(query.pageSize || 100, 100); // capped limit
    const startIdx = (page - 1) * pageSize;
    const paginatedData = sessions.slice(startIdx, startIdx + pageSize);

    return {
      data: paginatedData,
      total,
      page,
      pageSize,
    };
  }
}
