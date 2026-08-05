import { PurchaseOrder } from '../../../domain/entities/purchase_order.js';
import { PurchaseOrderPgRepository } from '../../../infrastructure/database/repositories/purchase_order.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export class GetPurchaseOrderUseCase {
  constructor(private poRepo: PurchaseOrderPgRepository) {}

  async execute(principal: Principal, id: string): Promise<PurchaseOrder | null> {
    // 1. Authorize read permission
    if (!RbacGuard.can(principal, 'purchase_order:read') && !RbacGuard.can(principal, 'purchase_orders:read')) {
      throw new Error('Forbidden: Insufficient permissions to read purchase order record');
    }

    // 2. Fetch record scoped to tenant
    const po = await this.poRepo.findById(principal.tenantId, id);

    // 3. Prevent cross-tenant existence leakage
    if (!po || po.tenantId !== principal.tenantId) {
      return null;
    }

    return po;
  }
}
