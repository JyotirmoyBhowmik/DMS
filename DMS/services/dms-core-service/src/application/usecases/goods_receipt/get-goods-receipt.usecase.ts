import { GoodsReceipt } from '../../../domain/entities/goods_receipt.js';
import { GoodsReceiptPgRepository } from '../../../infrastructure/database/repositories/goods_receipt.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export class GetGoodsReceiptUseCase {
  constructor(private grRepo: GoodsReceiptPgRepository) {}

  async execute(principal: Principal, id: string): Promise<GoodsReceipt | null> {
    // 1. Authorize read permission
    if (!RbacGuard.can(principal, 'goods_receipt:read') && !RbacGuard.can(principal, 'goods_receipts:read')) {
      throw new Error('Forbidden: Insufficient permissions to read goods receipt record');
    }

    // 2. Fetch record scoped to tenant
    const gr = await this.grRepo.findById(principal.tenantId, id);

    // 3. Prevent cross-tenant existence leakage
    if (!gr || gr.tenantId !== principal.tenantId) {
      return null;
    }

    return gr;
  }
}
