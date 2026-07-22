import { PriceList, PriceListStatus } from '../../../domain/entities/price_list.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';

export class PriceListPgRepository {
  private static inMemoryStore = new Map<string, PriceList>();

  static clearStore(): void {
    this.inMemoryStore.clear();
  }

  constructor(private db: PostgresDatabaseClient) {}

  async save(list: PriceList, _tenantId?: string): Promise<void> {
    PriceListPgRepository.inMemoryStore.set(list.id, list);
    const data = list.toJSON();
    await this.db.query(
      `INSERT INTO price_lists
        (id, tenant_id, name, code, currency, status, valid_from, valid_to, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         status = $6, name = $3, version = $9`,
      [data.id, data.tenantId, data.name, data.code, data.currency, data.status,
       data.validFrom ?? null, data.validTo ?? null, data.version],
      list.tenantId
    );
  }

  async update(list: PriceList, tenantId?: string): Promise<void> {
    await this.save(list, tenantId);
  }

  async findById(tenantId: string, id: string): Promise<PriceList | null> {
    const mem = PriceListPgRepository.inMemoryStore.get(id);
    if (mem && mem.tenantId === tenantId) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM price_lists WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findByCode(tenantId: string, code: string): Promise<PriceList | null> {
    const mem = Array.from(PriceListPgRepository.inMemoryStore.values()).find(
      l => l.tenantId === tenantId && l.code === code
    );
    if (mem) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM price_lists WHERE tenant_id = $1 AND code = $2`,
      [tenantId, code],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findAll(tenantId: string): Promise<PriceList[]> {
    const memList = Array.from(PriceListPgRepository.inMemoryStore.values()).filter(l => l.tenantId === tenantId);
    if (memList.length > 0) return memList;

    const result = await this.db.query<any>(
      `SELECT * FROM price_lists WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  private toDomain(row: any): PriceList {
    return new PriceList({
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      code: row.code,
      currency: row.currency,
      status: row.status as PriceListStatus,
      validFrom: row.valid_from,
      validTo: row.valid_to,
      version: row.version,
    });
  }
}
