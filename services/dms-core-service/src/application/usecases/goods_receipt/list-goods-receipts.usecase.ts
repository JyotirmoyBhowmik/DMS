import { GoodsReceipt, GoodsReceiptStatus } from '../../../domain/entities/goods_receipt.js';
import { GoodsReceiptPgRepository } from '../../../infrastructure/database/repositories/goods_receipt.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export interface ListGoodsReceiptsQuery {
  status?: GoodsReceiptStatus;
  purchaseOrderId?: string;
  warehouseId?: string;
  skuId?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedGoodsReceipts {
  data: GoodsReceipt[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class ListGoodsReceiptsUseCase {
  constructor(private grRepo: GoodsReceiptPgRepository) {}

  async execute(principal: Principal, query: ListGoodsReceiptsQuery): Promise<PaginatedGoodsReceipts> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'goods_receipt:read') && !RbacGuard.can(principal, 'goods_receipts:read')) {
      throw new Error('Forbidden: Insufficient permissions to list goods receipts');
    }

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    // 2. Fetch records
    let items = await this.grRepo.findAll(principal.tenantId);

    if (query.status) {
      items = items.filter(g => g.status === query.status);
    }
    if (query.purchaseOrderId) {
      items = items.filter(g => g.purchaseOrderId === query.purchaseOrderId);
    }
    if (query.warehouseId) {
      items = items.filter(g => g.warehouseId === query.warehouseId);
    }
    if (query.skuId) {
      items = items.filter(g => g.skuId === query.skuId);
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
