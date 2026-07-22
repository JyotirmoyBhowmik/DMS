import { StockTransfer } from '../../../domain/entities/stock_transfer.js';
import { StockTransferPgRepository } from '../../../infrastructure/database/repositories/stock_transfer.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export class GetStockTransferUseCase {
  constructor(private stockTransferRepo: StockTransferPgRepository) {}

  async execute(principal: Principal, id: string): Promise<StockTransfer | null> {
    // 1. Authorize read permission
    if (!RbacGuard.can(principal, 'stock_transfer:read') && !RbacGuard.can(principal, 'stock_transfers:read')) {
      throw new Error('Forbidden: Insufficient permissions to read stock transfer record');
    }

    // 2. Fetch record scoped to tenant
    const transfer = await this.stockTransferRepo.findById(principal.tenantId, id);

    // 3. Prevent cross-tenant existence leakage
    if (!transfer || transfer.tenantId !== principal.tenantId) {
      return null;
    }

    return transfer;
  }
}
