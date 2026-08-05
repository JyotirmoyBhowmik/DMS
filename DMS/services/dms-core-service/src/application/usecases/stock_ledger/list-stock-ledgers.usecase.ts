import { StockLedgerEntry, TransactionType } from '../../../domain/entities/stock_ledger_entry.js';
import { StockLedgerPgRepository } from '../../../infrastructure/database/repositories/stock_ledger.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export interface ListStockLedgersQuery {
  transactionType?: TransactionType;
  warehouseId?: string;
  skuId?: string;
  batchNumber?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedStockLedgers {
  data: StockLedgerEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class ListStockLedgersUseCase {
  constructor(private stockLedgerRepo: StockLedgerPgRepository) {}

  async execute(principal: Principal, query: ListStockLedgersQuery): Promise<PaginatedStockLedgers> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'stock_ledger:read') && !RbacGuard.can(principal, 'stock_ledgers:read')) {
      throw new Error('Forbidden: Insufficient permissions to list stock ledger entries');
    }

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    // 2. Fetch records
    let items = await this.stockLedgerRepo.findAll(principal.tenantId);

    if (query.transactionType) {
      items = items.filter(i => i.transactionType === query.transactionType);
    }
    if (query.warehouseId) {
      items = items.filter(i => i.warehouseId === query.warehouseId);
    }
    if (query.skuId) {
      items = items.filter(i => i.skuId === query.skuId);
    }
    if (query.batchNumber) {
      items = items.filter(i => i.batchNumber === query.batchNumber);
    }

    const total = items.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const offset = (page - 1) * pageSize;
    const paginatedData = items.slice(offset, offset + pageSize);

    return {
      data: paginatedData,
      total,
      page,
      pageSize,
      totalPages,
    };
  }
}
