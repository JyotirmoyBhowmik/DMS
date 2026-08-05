import { SchemePayout } from '../../domain/entities/scheme_payout.js';
import { SchemePayoutPgRepository } from '../../infrastructure/database/repositories/scheme_payout.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export class GetSchemePayoutUseCase {
  constructor(private payoutRepo: SchemePayoutPgRepository) {}

  async execute(principal: Principal, id: string): Promise<SchemePayout | null> {
    // 1. Authorize read permission
    if (!RbacGuard.can(principal, 'scheme_payout:read') && !RbacGuard.can(principal, 'scheme_payouts:read')) {
      throw new Error('Forbidden: Insufficient permissions to read scheme payout record');
    }

    // 2. Fetch record scoped to tenant
    const payout = await this.payoutRepo.findById(principal.tenantId, id);

    // 3. Prevent cross-tenant existence leakage
    if (!payout || payout.tenantId !== principal.tenantId) {
      return null;
    }

    return payout;
  }
}
