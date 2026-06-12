import { BasePostgresRepository, BaseRow, PostgresDatabaseClient } from '@dms/pkg-database';
import { Inventory } from '../../../domain/entities/inventory.js';
import { InventoryRepository } from '../../../domain/repositories/inventory.repository.js';
import { createHash } from 'node:crypto';

function toUuid(val: string | undefined | null): string {
  if (!val) return '00000000-0000-0000-0000-000000000000';
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(val)) return val;
  
  const hash = createHash('md5').update(val).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

export class InventoryPgRepository extends BasePostgresRepository<Inventory> implements InventoryRepository {
  constructor(db: PostgresDatabaseClient) {
    super(db);
  }

  protected tableName(): string {
    return 'inventory_records';
  }

  protected mapToEntity(row: BaseRow): Inventory {
    return new Inventory(
      row.id as string,
      row.tenant_id as string,
      row.product_id as string,
      row.warehouse_id as string,
      Number(row.stock),
      row.version as number
    );
  }

  protected mapToRow(entity: Inventory): BaseRow {
    return {
      id: toUuid(entity.id),
      tenant_id: toUuid(entity.tenantId),
      product_id: toUuid(entity.productId),
      warehouse_id: entity.warehouseId,
      stock: entity.stock,
      version: entity.version,
      created_at: new Date(),
      updated_at: new Date(),
    };
  }

  async findByProduct(productId: string, tenantId: string): Promise<Inventory[]> {
    const sql = `SELECT * FROM "${this.tableName()}" WHERE "product_id" = $1 AND "tenant_id" = $2`;
    const result = await this.db.query<BaseRow>(sql, [toUuid(productId), toUuid(tenantId)], tenantId);
    return result.rows.map(r => this.mapToEntity(r));
  }

  async findByWarehouse(warehouseId: string, tenantId: string): Promise<Inventory[]> {
    const sql = `SELECT * FROM "${this.tableName()}" WHERE "warehouse_id" = $1 AND "tenant_id" = $2`;
    const result = await this.db.query<BaseRow>(sql, [warehouseId, toUuid(tenantId)], tenantId);
    return result.rows.map(r => this.mapToEntity(r));
  }

  async findByProductAndWarehouse(productId: string, warehouseId: string, tenantId: string): Promise<Inventory | null> {
    const sql = `SELECT * FROM "${this.tableName()}" WHERE "product_id" = $1 AND "warehouse_id" = $2 AND "tenant_id" = $3 LIMIT 1`;
    const result = await this.db.query<BaseRow>(sql, [toUuid(productId), warehouseId, toUuid(tenantId)], tenantId);
    if (result.rows.length === 0) return null;
    return this.mapToEntity(result.rows[0]!);
  }
}
