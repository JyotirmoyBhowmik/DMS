import { SalesTargetRepository } from '../../../domain/repositories/sales-target.repository.js';
import { SalesTarget } from '../../../domain/entities/sales-target.js';
import { RbacGuard, Principal } from '@dms/pkg-rbac';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { SalesTargetPgRepository } from '../../../infrastructure/database/repositories/sales-target.pg-repository.js';

export class GetSalesTargetUseCase {
  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: SalesTargetRepository
  ) {}

  async execute(principal: Principal, id: string, tenantId: string): Promise<SalesTarget> {
    if (!principal) {
      throw new Error('Forbidden: Authentication required');
    }
    if (principal.tenantId !== tenantId) {
      throw new Error('Forbidden: Tenant context mismatch');
    }
    if (!RbacGuard.can(principal, 'sales_target:read')) {
      throw new Error('Forbidden: Insufficient permissions to view sales target');
    }

    const activeRepo = this.repo || new SalesTargetPgRepository(this.db);
    const target = await activeRepo.findById(id, tenantId);

    if (!target || target.tenantId !== tenantId) {
      throw new Error(`Sales target with ID ${id} not found`);
    }

    // Agent can only see their own sales targets
    if (principal.roles.includes('agent') && target.agentId !== principal.id) {
      // Allow if agent has permission to read others, otherwise reject
      // But standard agent cannot read other agent's targets
      throw new Error('Forbidden: You can only access your own sales targets');
    }

    return target;
  }
}
