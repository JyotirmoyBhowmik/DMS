import { Scheme } from '../../domain/entities/scheme.js';
import { SchemePgRepository } from '../../infrastructure/database/repositories/scheme.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export class GetSchemeUseCase {
  constructor(private schemeRepo: SchemePgRepository) {}

  async execute(principal: Principal, id: string): Promise<Scheme | null> {
    // 1. Authorize read permission
    if (!RbacGuard.can(principal, 'scheme:read') && !RbacGuard.can(principal, 'schemes:read')) {
      throw new Error('Forbidden: Insufficient permissions to read scheme record');
    }

    // 2. Fetch record scoped to tenant
    const scheme = await this.schemeRepo.findById(principal.tenantId, id);

    // 3. Prevent cross-tenant existence leakage
    if (!scheme || scheme.tenantId !== principal.tenantId) {
      return null;
    }

    return scheme;
  }
}
