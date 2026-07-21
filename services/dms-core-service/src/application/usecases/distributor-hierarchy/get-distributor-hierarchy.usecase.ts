import { DistributorHierarchy } from '../../../domain/entities/distributor-hierarchy.js';
import { DistributorHierarchyPgRepository } from '../../../infrastructure/database/repositories/distributor-hierarchy.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export class GetDistributorHierarchyUseCase {
  constructor(private hierarchyRepo: DistributorHierarchyPgRepository) {}

  async execute(principal: Principal, id: string): Promise<DistributorHierarchy | null> {
    // 1. Authorize read permission
    if (!RbacGuard.can(principal, 'distributor_hierarchy:read') && !RbacGuard.can(principal, 'distributor-hierarchies:read')) {
      throw new Error('Forbidden: Insufficient permissions to read distributor hierarchy');
    }

    // 2. Fetch via repository (scoped to principal.tenantId)
    const hierarchy = await this.hierarchyRepo.findById(principal.tenantId, id);

    // 3. Return clean not-found (no existence leak across tenants)
    if (!hierarchy || hierarchy.tenantId !== principal.tenantId) {
      return null;
    }

    return hierarchy;
  }
}
