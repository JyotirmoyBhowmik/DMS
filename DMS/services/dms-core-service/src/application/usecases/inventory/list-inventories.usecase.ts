import { Inventory, InventoryStatus } from '../../../domain/entities/inventory.js';
import { InventoryPgRepository } from '../../../infrastructure/database/repositories/inventory.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export interface ListInventoriesQuery {
  status?: InventoryStatus;
  warehouseId?: string;
  skuId?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedInventories {
  data: Inventory[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class ListInventoriesUseCase {
  constructor(private inventoryRepo: InventoryPgRepository) {}

  async execute(principal: Principal, query: ListInventoriesQuery): Promise<PaginatedInventories> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'inventory:read') && !RbacGuard.can(principal, 'inventories:read')) {
      throw new Error('Forbidden: Insufficient permissions to list inventory entries');
    }

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    // 2. Fetch records
    let items: Inventory[] = [];
    if (query.warehouseId && query.skuId) {
      const single = await this.inventoryRepo.findByWarehouseAndSku(principal.tenantId, query.warehouseId, query.skuId);
      items = single ? [single] : [];
    } else if (query.status) {
      items = await this.inventoryRepo.findByStatus(principal.tenantId, query.status);
    } else {
      items = await this.inventoryRepo.findAll(principal.tenantId);
    }

    if (query.warehouseId) {
      items = items.filter(i => i.warehouseId === query.warehouseId);
    }
    if (query.skuId) {
      items = items.filter(i => i.skuId === query.skuId);
    }
    if (query.status) {
      items = items.filter(i => i.status === query.status);
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
