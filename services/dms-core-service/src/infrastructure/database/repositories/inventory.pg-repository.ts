import { Inventory, InventoryStatus } from '../../../domain/entities/inventory.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';

export class InventoryPgRepository {
  private static inMemoryStore = new Map<string, Inventory>();

  static clearStore(): void {
    this.inMemoryStore.clear();
  }

  constructor(private db: PostgresDatabaseClient) {}

  async save(inv: Inventory, _tenantId?: string): Promise<void> {
    InventoryPgRepository.inMemoryStore.set(inv.id, inv);
    const data = inv.toJSON();
    await this.db.query(
      `INSERT INTO inventory
        (id, tenant_id, warehouse_id, sku_id, quantity_available, quantity_reserved, reorder_level, status, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         quantity_available = $5, quantity_reserved = $6, reorder_level = $7,
         status = $8, version = $9`,
      [data.id, data.tenantId, data.warehouseId, data.skuId, data.quantityAvailable,
       data.quantityReserved, data.reorderLevel, data.status, data.version],
      inv.tenantId
    );
  }

  async findById(tenantId: string, id: string): Promise<Inventory | null> {
    const mem = InventoryPgRepository.inMemoryStore.get(id);
    if (mem && mem.tenantId === tenantId) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM inventory WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async update(inv: Inventory, tenantId?: string): Promise<void> {
    await this.save(inv, tenantId);
  }

  async findByWarehouseAndSku(tenantId: string, warehouseId: string, skuId: string): Promise<Inventory | null> {
    const mem = Array.from(InventoryPgRepository.inMemoryStore.values()).find(
      i => i.tenantId === tenantId && i.warehouseId === warehouseId && i.skuId === skuId
    );
    if (mem) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM inventory WHERE tenant_id = $1 AND warehouse_id = $2 AND sku_id = $3`,
      [tenantId, warehouseId, skuId],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findByProductAndWarehouse(productId: string, warehouseId: string, tenantId?: string): Promise<Inventory | null> {
    const tid = tenantId || '00000000-0000-0000-0000-000000000001';
    return this.findByWarehouseAndSku(tid, warehouseId, productId);
  }


  async findByStatus(tenantId: string, status: InventoryStatus): Promise<Inventory[]> {
    const memList = Array.from(InventoryPgRepository.inMemoryStore.values()).filter(i => i.tenantId === tenantId && i.status === status);
    if (memList.length > 0) return memList;

    const result = await this.db.query<any>(
      `SELECT * FROM inventory WHERE tenant_id = $1 AND status = $2`,
      [tenantId, status],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  async findAll(tenantId: string): Promise<Inventory[]> {
    const memList = Array.from(InventoryPgRepository.inMemoryStore.values()).filter(i => i.tenantId === tenantId);
    if (memList.length > 0) return memList;

    const result = await this.db.query<any>(
      `SELECT * FROM inventory WHERE tenant_id = $1 ORDER BY warehouse_id, sku_id`,
      [tenantId],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  private toDomain(row: any): Inventory {
    return new Inventory({
      id: row.id,
      tenantId: row.tenant_id,
      warehouseId: row.warehouse_id,
      skuId: row.sku_id,
      quantityAvailable: Number(row.quantity_available ?? row.stock ?? 0),
      quantityReserved: Number(row.quantity_reserved ?? 0),
      reorderLevel: Number(row.reorder_level ?? 10),
      status: row.status as InventoryStatus,
      version: row.version,
    });
  }
}
