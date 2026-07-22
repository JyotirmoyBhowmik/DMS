import { PriceSlab, PriceSlabStatus } from '../../../domain/entities/price_slab.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';

export class PriceSlabPgRepository {
  private static inMemoryStore = new Map<string, PriceSlab>();

  static clearStore(): void {
    this.inMemoryStore.clear();
  }

  constructor(private db: PostgresDatabaseClient) {}

  async save(slab: PriceSlab, _tenantId?: string): Promise<void> {
    PriceSlabPgRepository.inMemoryStore.set(slab.id, slab);
    const data = slab.toJSON();
    await this.db.query(
      `INSERT INTO price_slabs
        (id, tenant_id, price_list_id, sku_id, min_quantity, max_quantity, price_cents, status, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         status = $8, price_cents = $7, version = $9`,
      [data.id, data.tenantId, data.priceListId, data.skuId, data.minQuantity,
       data.maxQuantity, data.priceCents, data.status, data.version],
      slab.tenantId
    );
  }

  async update(slab: PriceSlab, tenantId?: string): Promise<void> {
    await this.save(slab, tenantId);
  }

  async findById(tenantId: string, id: string): Promise<PriceSlab | null> {
    const mem = PriceSlabPgRepository.inMemoryStore.get(id);
    if (mem && mem.tenantId === tenantId) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM price_slabs WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findAll(tenantId: string): Promise<PriceSlab[]> {
    const memList = Array.from(PriceSlabPgRepository.inMemoryStore.values()).filter(s => s.tenantId === tenantId);
    if (memList.length > 0) return memList;

    const result = await this.db.query<any>(
      `SELECT * FROM price_slabs WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  private toDomain(row: any): PriceSlab {
    return new PriceSlab({
      id: row.id,
      tenantId: row.tenant_id,
      priceListId: row.price_list_id,
      skuId: row.sku_id,
      minQuantity: Number(row.min_quantity),
      maxQuantity: Number(row.max_quantity),
      priceCents: Number(row.price_cents),
      status: row.status as PriceSlabStatus,
      version: row.version,
    });
  }
}
