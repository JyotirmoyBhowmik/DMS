import { Replacement } from '../../../domain/entities/replacement.js';
import { ReplacementPgRepository } from '../../../infrastructure/database/repositories/replacement.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export class GetReplacementUseCase {
  constructor(private repRepo: ReplacementPgRepository) {}

  async execute(principal: Principal, id: string): Promise<Replacement | null> {
    // 1. Authorize read permission
    if (!RbacGuard.can(principal, 'replacement:read') && !RbacGuard.can(principal, 'replacements:read')) {
      throw new Error('Forbidden: Insufficient permissions to read replacement record');
    }

    // 2. Fetch record scoped to tenant
    const rep = await this.repRepo.findById(principal.tenantId, id);

    // 3. Prevent cross-tenant existence leakage
    if (!rep || rep.tenantId !== principal.tenantId) {
      return null;
    }

    return rep;
  }
}
