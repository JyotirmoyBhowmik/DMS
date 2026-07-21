import { Outlet } from '../../../domain/entities/outlet.js';
import { OutletPgRepository } from '../../../infrastructure/database/repositories/outlet.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export class GetOutletUseCase {
  constructor(private outletRepo: OutletPgRepository) {}

  async execute(principal: Principal, id: string): Promise<Outlet | null> {
    // 1. Authorize read permission
    if (!RbacGuard.can(principal, 'outlet:read') && !RbacGuard.can(principal, 'outlets:read')) {
      throw new Error('Forbidden: Insufficient permissions to read outlet');
    }

    // 2. Fetch record scoped to tenant
    const outlet = await this.outletRepo.findById(principal.tenantId, id);

    // 3. Prevent cross-tenant existence leakage
    if (!outlet || outlet.tenantId !== principal.tenantId) {
      return null;
    }

    return outlet;
  }
}
