import { CreditLimit } from '../../../domain/entities/credit-limit.js';
import { CreditLimitPgRepository } from '../../../infrastructure/database/repositories/credit-limit.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export class GetCreditLimitUseCase {
  constructor(private creditLimitRepo: CreditLimitPgRepository) {}

  async execute(principal: Principal, id: string): Promise<CreditLimit | null> {
    // 1. Authorize read permission
    if (!RbacGuard.can(principal, 'credit_limit:read') && !RbacGuard.can(principal, 'credit-limits:read')) {
      throw new Error('Forbidden: Insufficient permissions to read credit limit');
    }

    // 2. Fetch record scoped to tenant
    const cl = await this.creditLimitRepo.findById(principal.tenantId, id);

    // 3. Prevent cross-tenant existence leakage
    if (!cl || cl.tenantId !== principal.tenantId) {
      return null;
    }

    return cl;
  }
}
