import { ReturnEntity, ReturnStatus } from '../../../domain/entities/return.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';

export class ReturnPgRepository {
  private static inMemoryStore = new Map<string, ReturnEntity>();

  static clearStore(): void {
    this.inMemoryStore.clear();
  }

  constructor(private db: PostgresDatabaseClient) {}

  async save(ret: ReturnEntity, _tenantId?: string): Promise<void> {
    ReturnPgRepository.inMemoryStore.set(ret.id, ret);
    const data = ret.toJSON();
    await this.db.query(
      `INSERT INTO returns
        (id, tenant_id, return_number, outlet_id, warehouse_id, sku_id, quantity, reason, total_amount_cents, status, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE SET
         status = $10, version = $11`,
      [data.id, data.tenantId, data.returnNumber, data.outletId, data.warehouseId,
       data.skuId, data.quantity, data.reason, data.totalAmountCents, data.status, data.version],
      ret.tenantId
    );
  }

  async update(ret: ReturnEntity, tenantId?: string): Promise<void> {
    await this.save(ret, tenantId);
  }

  async findById(tenantId: string, id: string): Promise<ReturnEntity | null> {
    const mem = ReturnPgRepository.inMemoryStore.get(id);
    if (mem && mem.tenantId === tenantId) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM returns WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findByReturnNumber(tenantId: string, returnNumber: string): Promise<ReturnEntity | null> {
    const mem = Array.from(ReturnPgRepository.inMemoryStore.values()).find(
      r => r.tenantId === tenantId && r.returnNumber === returnNumber
    );
    if (mem) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM returns WHERE tenant_id = $1 AND return_number = $2`,
      [tenantId, returnNumber],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findAll(tenantId: string): Promise<ReturnEntity[]> {
    const memList = Array.from(ReturnPgRepository.inMemoryStore.values()).filter(r => r.tenantId === tenantId);
    if (memList.length > 0) return memList;

    const result = await this.db.query<any>(
      `SELECT * FROM returns WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  private toDomain(row: any): ReturnEntity {
    return new ReturnEntity({
      id: row.id,
      tenantId: row.tenant_id,
      returnNumber: row.return_number,
      outletId: row.outlet_id,
      warehouseId: row.warehouse_id,
      skuId: row.sku_id,
      quantity: Number(row.quantity),
      reason: row.reason,
      totalAmountCents: Number(row.total_amount_cents),
      status: row.status as ReturnStatus,
      version: row.version,
    });
  }
}
