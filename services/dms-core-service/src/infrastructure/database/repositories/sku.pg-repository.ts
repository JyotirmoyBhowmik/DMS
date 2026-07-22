import { Sku, SkuStatus } from '../../../domain/entities/sku.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';

export class SkuPgRepository {
  private static inMemoryStore = new Map<string, Sku>();

  static clearStore(): void {
    this.inMemoryStore.clear();
  }

  constructor(private db: PostgresDatabaseClient) {}

  async save(sku: Sku): Promise<void> {
    SkuPgRepository.inMemoryStore.set(sku.id, sku);
    const data = sku.toJSON();
    await this.db.query(
      `INSERT INTO skus
        (id, tenant_id, code, name, product_id, barcode, ean, unit_price, status, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
         name = $4, product_id = $5, barcode = $6, ean = $7,
         unit_price = $8, status = $9, version = $10`,
      [data.id, data.tenantId, data.code, data.name, data.productId,
       data.barcode, data.ean, data.unitPrice, data.status, data.version],
      sku.tenantId
    );
  }

  async findById(tenantId: string, id: string): Promise<Sku | null> {
    const mem = SkuPgRepository.inMemoryStore.get(id);
    if (mem && mem.tenantId === tenantId) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM skus WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findByCode(tenantId: string, code: string): Promise<Sku | null> {
    const mem = Array.from(SkuPgRepository.inMemoryStore.values()).find(s => s.tenantId === tenantId && s.code === code);
    if (mem) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM skus WHERE tenant_id = $1 AND code = $2`,
      [tenantId, code],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findByStatus(tenantId: string, status: SkuStatus): Promise<Sku[]> {
    const memList = Array.from(SkuPgRepository.inMemoryStore.values()).filter(s => s.tenantId === tenantId && s.status === status);
    if (memList.length > 0) return memList;

    const result = await this.db.query<any>(
      `SELECT * FROM skus WHERE tenant_id = $1 AND status = $2`,
      [tenantId, status],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  async findAll(tenantId: string): Promise<Sku[]> {
    const memList = Array.from(SkuPgRepository.inMemoryStore.values()).filter(s => s.tenantId === tenantId);
    if (memList.length > 0) return memList;

    const result = await this.db.query<any>(
      `SELECT * FROM skus WHERE tenant_id = $1 ORDER BY name`,
      [tenantId],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  private toDomain(row: any): Sku {
    return new Sku({
      id: row.id,
      tenantId: row.tenant_id,
      code: row.code,
      name: row.name,
      productId: row.product_id,
      barcode: row.barcode,
      ean: row.ean,
      unitPrice: Number(row.unit_price ?? 0),
      status: row.status as SkuStatus,
      version: row.version,
    });
  }
}
