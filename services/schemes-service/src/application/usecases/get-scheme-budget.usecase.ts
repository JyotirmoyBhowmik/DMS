import { SchemeBudget } from '../../domain/entities/scheme_budget.js';
import { SchemeBudgetPgRepository } from '../../infrastructure/database/repositories/scheme_budget.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export class GetSchemeBudgetUseCase {
  constructor(private budgetRepo: SchemeBudgetPgRepository) {}

  async execute(principal: Principal, id: string): Promise<SchemeBudget | null> {
    // 1. Authorize read permission
    if (!RbacGuard.can(principal, 'scheme_budget:read') && !RbacGuard.can(principal, 'scheme_budgets:read')) {
      throw new Error('Forbidden: Insufficient permissions to read scheme budget record');
    }

    // 2. Fetch record scoped to tenant
    const budget = await this.budgetRepo.findById(principal.tenantId, id);

    // 3. Prevent cross-tenant existence leakage
    if (!budget || budget.tenantId !== principal.tenantId) {
      return null;
    }

    return budget;
  }
}
