import { PurchaseOrder, PurchaseOrderStatus } from '../../../domain/entities/purchase_order.js';
import { PurchaseOrderPgRepository } from '../../../infrastructure/database/repositories/purchase_order.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export interface ListPurchaseOrdersQuery {
  status?: PurchaseOrderStatus;
  supplierId?: string;
  warehouseId?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedPurchaseOrders {
  data: PurchaseOrder[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class ListPurchaseOrdersUseCase {
  constructor(private poRepo: PurchaseOrderPgRepository) {}

  async execute(principal: Principal, query: ListPurchaseOrdersQuery): Promise<PaginatedPurchaseOrders> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'purchase_order:read') && !RbacGuard.can(principal, 'purchase_orders:read')) {
      throw new Error('Forbidden: Insufficient permissions to list purchase orders');
    }

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    // 2. Fetch records
    let items = await this.poRepo.findAll(principal.tenantId);

    if (query.status) {
      items = items.filter(p => p.status === query.status);
    }
    if (query.supplierId) {
      items = items.filter(p => p.supplierId === query.supplierId);
    }
    if (query.warehouseId) {
      items = items.filter(p => p.warehouseId === query.warehouseId);
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
