import { StockTransfer, StockTransferStatus } from '../../../domain/entities/stock_transfer.js';
import { StockTransferPgRepository } from '../../../infrastructure/database/repositories/stock_transfer.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export interface ListStockTransfersQuery {
  status?: StockTransferStatus;
  sourceWarehouseId?: string;
  targetWarehouseId?: string;
  skuId?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedStockTransfers {
  data: StockTransfer[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class ListStockTransfersUseCase {
  constructor(private stockTransferRepo: StockTransferPgRepository) {}

  async execute(principal: Principal, query: ListStockTransfersQuery): Promise<PaginatedStockTransfers> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'stock_transfer:read') && !RbacGuard.can(principal, 'stock_transfers:read')) {
      throw new Error('Forbidden: Insufficient permissions to list stock transfers');
    }

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    // 2. Fetch records
    let items = await this.stockTransferRepo.findAll(principal.tenantId);

    if (query.status) {
      items = items.filter(t => t.status === query.status);
    }
    if (query.sourceWarehouseId) {
      items = items.filter(t => t.sourceWarehouseId === query.sourceWarehouseId);
    }
    if (query.targetWarehouseId) {
      items = items.filter(t => t.targetWarehouseId === query.targetWarehouseId);
    }
    if (query.skuId) {
      items = items.filter(t => t.skuId === query.skuId);
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
