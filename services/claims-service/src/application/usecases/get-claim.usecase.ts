import { Claim } from '../../domain/entities/claim.js';
import { ClaimPgRepository } from '../../infrastructure/database/repositories/claim.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export class GetClaimUseCase {
  constructor(private claimRepo: ClaimPgRepository) {}

  async execute(principal: Principal, id: string): Promise<Claim | null> {
    // 1. Authorize read permission
    if (!RbacGuard.can(principal, 'claim:read') && !RbacGuard.can(principal, 'claims:read')) {
      throw new Error('Forbidden: Insufficient permissions to read claim record');
    }

    // 2. Fetch record scoped to tenant
    const claim = await this.claimRepo.findById(principal.tenantId, id);

    // 3. Prevent cross-tenant existence leakage
    if (!claim || claim.tenantId !== principal.tenantId) {
      return null;
    }

    return claim;
  }
}
