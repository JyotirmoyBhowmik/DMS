import { StockLedgerEntry } from '../../../domain/entities/stock_ledger_entry.js';
import { StockLedgerPgRepository } from '../../../infrastructure/database/repositories/stock_ledger.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export class GetStockLedgerUseCase {
  constructor(private stockLedgerRepo: StockLedgerPgRepository) {}

  async execute(principal: Principal, id: string): Promise<StockLedgerEntry | null> {
    // 1. Authorize read permission
    if (!RbacGuard.can(principal, 'stock_ledger:read') && !RbacGuard.can(principal, 'stock_ledgers:read')) {
      throw new Error('Forbidden: Insufficient permissions to read stock ledger entry');
    }

    // 2. Fetch record scoped to tenant
    const entry = await this.stockLedgerRepo.findById(principal.tenantId, id);

    // 3. Prevent cross-tenant existence leakage
    if (!entry || entry.tenantId !== principal.tenantId) {
      return null;
    }

    return entry;
  }
}
