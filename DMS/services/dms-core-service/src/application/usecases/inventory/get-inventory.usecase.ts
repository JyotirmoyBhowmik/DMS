import { Inventory } from '../../../domain/entities/inventory.js';
import { InventoryPgRepository } from '../../../infrastructure/database/repositories/inventory.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export class GetInventoryUseCase {
  constructor(private inventoryRepo: InventoryPgRepository) {}

  async execute(principal: Principal, id: string): Promise<Inventory | null> {
    // 1. Authorize read permission
    if (!RbacGuard.can(principal, 'inventory:read') && !RbacGuard.can(principal, 'inventories:read')) {
      throw new Error('Forbidden: Insufficient permissions to read inventory record');
    }

    // 2. Fetch record scoped to tenant
    const inv = await this.inventoryRepo.findById(principal.tenantId, id);

    // 3. Prevent cross-tenant existence leakage
    if (!inv || inv.tenantId !== principal.tenantId) {
      return null;
    }

    return inv;
  }
}
