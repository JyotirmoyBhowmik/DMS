import { Replacement, ReplacementStatus } from '../../../domain/entities/replacement.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';

export class ReplacementPgRepository {
  private static inMemoryStore = new Map<string, Replacement>();

  static clearStore(): void {
    this.inMemoryStore.clear();
  }

  constructor(private db: PostgresDatabaseClient) {}

  async save(rep: Replacement, _tenantId?: string): Promise<void> {
    ReplacementPgRepository.inMemoryStore.set(rep.id, rep);
    const data = rep.toJSON();
    await this.db.query(
      `INSERT INTO replacements
        (id, tenant_id, replacement_number, return_id, outlet_id, warehouse_id, sku_id, quantity, status, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
         status = $9, version = $10`,
      [data.id, data.tenantId, data.replacementNumber, data.returnId, data.outletId,
       data.warehouseId, data.skuId, data.quantity, data.status, data.version],
      rep.tenantId
    );
  }

  async update(rep: Replacement, tenantId?: string): Promise<void> {
    await this.save(rep, tenantId);
  }

  async findById(tenantId: string, id: string): Promise<Replacement | null> {
    const mem = ReplacementPgRepository.inMemoryStore.get(id);
    if (mem && mem.tenantId === tenantId) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM replacements WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findByReplacementNumber(tenantId: string, replacementNumber: string): Promise<Replacement | null> {
    const mem = Array.from(ReplacementPgRepository.inMemoryStore.values()).find(
      r => r.tenantId === tenantId && r.replacementNumber === replacementNumber
    );
    if (mem) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM replacements WHERE tenant_id = $1 AND replacement_number = $2`,
      [tenantId, replacementNumber],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findAll(tenantId: string): Promise<Replacement[]> {
    const memList = Array.from(ReplacementPgRepository.inMemoryStore.values()).filter(r => r.tenantId === tenantId);
    if (memList.length > 0) return memList;

    const result = await this.db.query<any>(
      `SELECT * FROM replacements WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  private toDomain(row: any): Replacement {
    return new Replacement({
      id: row.id,
      tenantId: row.tenant_id,
      replacementNumber: row.replacement_number,
      returnId: row.return_id,
      outletId: row.outlet_id,
      warehouseId: row.warehouse_id,
      skuId: row.sku_id,
      quantity: Number(row.quantity),
      status: row.status as ReplacementStatus,
      version: row.version,
    });
  }
}
