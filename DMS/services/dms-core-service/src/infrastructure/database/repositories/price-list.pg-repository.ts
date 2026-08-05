/**
 * Postgres Repository for PriceList.
 */
import { PriceList, PriceListEntry } from '../../../domain/entities/price-list.js';
import { PriceListRepository } from '../../../domain/repositories/price-list.repository.js';

export class PriceListPgRepository extends PriceListRepository {
  constructor(private pool: any) {
    super();
  }

  async save(pl: PriceList): Promise<void> {
    const data = pl.toJSON();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO price_lists
          (id, tenant_id, name, effective_from, effective_to, is_active, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           name = $3, effective_from = $4, effective_to = $5, is_active = $6, version = $7`,
        [data.id, data.tenantId, data.name, data.effectiveFrom,
         data.effectiveTo ?? null, data.isActive, data.version]
      );

      // Upsert entries
      await client.query(`DELETE FROM price_list_entries WHERE price_list_id = $1`, [data.id]);
      for (const entry of data.entries) {
        await client.query(
          `INSERT INTO price_list_entries
            (id, price_list_id, product_id, base_price, mrp)
           VALUES ($1, $2, $3, $4, $5)`,
          [entry.id ?? crypto.randomUUID?.() ?? `ple-${Date.now()}`, data.id,
           entry.productId, entry.basePrice, entry.mrp]
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async findById(tenantId: string, id: string): Promise<PriceList | null> {
    const result = await this.pool.query(
      `SELECT * FROM price_lists WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id]
    );
    if (!result.rows[0]) return null;
    const entries = await this.findEntriesByList(id);
    return this.toDomain(result.rows[0], entries);
  }

  async findByName(tenantId: string, name: string): Promise<PriceList | null> {
    const result = await this.pool.query(
      `SELECT * FROM price_lists WHERE tenant_id = $1 AND name = $2`,
      [tenantId, name]
    );
    if (!result.rows[0]) return null;
    const entries = await this.findEntriesByList(result.rows[0].id);
    return this.toDomain(result.rows[0], entries);
  }

  async findActive(tenantId: string): Promise<PriceList[]> {
    const result = await this.pool.query(
      `SELECT * FROM price_lists WHERE tenant_id = $1 AND is_active = true ORDER BY effective_from DESC`,
      [tenantId]
    );
    return Promise.all(result.rows.map(async (r: any) => {
      const entries = await this.findEntriesByList(r.id);
      return this.toDomain(r, entries);
    }));
  }

  async findEffective(tenantId: string, asOfDate?: string): Promise<PriceList[]> {
    const date = asOfDate ?? new Date().toISOString().split('T')[0];
    const result = await this.pool.query(
      `SELECT * FROM price_lists
       WHERE tenant_id = $1 AND is_active = true
         AND effective_from <= $2
         AND (effective_to IS NULL OR effective_to >= $2)
       ORDER BY effective_from DESC`,
      [tenantId, date]
    );
    return Promise.all(result.rows.map(async (r: any) => {
      const entries = await this.findEntriesByList(r.id);
      return this.toDomain(r, entries);
    }));
  }

  async findAll(tenantId: string): Promise<PriceList[]> {
    const result = await this.pool.query(
      `SELECT * FROM price_lists WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId]
    );
    return Promise.all(result.rows.map(async (r: any) => {
      const entries = await this.findEntriesByList(r.id);
      return this.toDomain(r, entries);
    }));
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM price_lists WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id]
    );
  }

  private async findEntriesByList(priceListId: string): Promise<PriceListEntry[]> {
    const result = await this.pool.query(
      `SELECT * FROM price_list_entries WHERE price_list_id = $1 ORDER BY created_at`,
      [priceListId]
    );
    return result.rows.map((r: any) => ({
      id: r.id,
      productId: r.product_id,
      basePrice: Number(r.base_price),
      mrp: Number(r.mrp),
    }));
  }

  private toDomain(row: any, entries: PriceListEntry[]): PriceList {
    return new PriceList({
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      effectiveFrom: row.effective_from?.toISOString?.()?.split('T')[0] ?? row.effective_from,
      effectiveTo: row.effective_to?.toISOString?.()?.split('T')[0] ?? row.effective_to,
      entries,
      isActive: row.is_active,
      version: row.version,
    });
  }
}
