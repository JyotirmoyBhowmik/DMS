import { Inventory } from '../entities/inventory.js';
import { PaginatedResult, FindAllOptions } from '@dms/pkg-database';

export interface InventoryRepository {
  save(entity: Inventory, tenantId: string): Promise<Inventory>;
  findById(id: string, tenantId: string): Promise<Inventory>;
  findAll(tenantId: string, options?: FindAllOptions): Promise<PaginatedResult<Inventory>>;
  update(entity: Inventory, tenantId: string): Promise<Inventory>;
  delete(id: string, tenantId: string): Promise<boolean>;
  findByProduct(productId: string, tenantId: string): Promise<Inventory[]>;
  findByWarehouse(warehouseId: string, tenantId: string): Promise<Inventory[]>;
  findByProductAndWarehouse(productId: string, warehouseId: string, tenantId: string): Promise<Inventory | null>;
}
