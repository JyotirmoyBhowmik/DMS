import { GeoPriceRule, GeoPriceRuleStatus } from '../../../domain/entities/geo_price_rule.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';

export class GeoPriceRulePgRepository {
  private static inMemoryStore = new Map<string, GeoPriceRule>();

  static clearStore(): void {
    this.inMemoryStore.clear();
  }

  constructor(private db: PostgresDatabaseClient) {}

  async save(rule: GeoPriceRule, _tenantId?: string): Promise<void> {
    GeoPriceRulePgRepository.inMemoryStore.set(rule.id, rule);
    const data = rule.toJSON();
    await this.db.query(
      `INSERT INTO geo_price_rules
        (id, tenant_id, price_list_id, region_code, multiplier, price_adjustment_cents, status, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         status = $7, multiplier = $5, price_adjustment_cents = $6, version = $8`,
      [data.id, data.tenantId, data.priceListId, data.regionCode, data.multiplier,
       data.priceAdjustmentCents, data.status, data.version],
      rule.tenantId
    );
  }

  async update(rule: GeoPriceRule, tenantId?: string): Promise<void> {
    await this.save(rule, tenantId);
  }

  async findById(tenantId: string, id: string): Promise<GeoPriceRule | null> {
    const mem = GeoPriceRulePgRepository.inMemoryStore.get(id);
    if (mem && mem.tenantId === tenantId) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM geo_price_rules WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findByRegion(tenantId: string, priceListId: string, regionCode: string): Promise<GeoPriceRule | null> {
    const mem = Array.from(GeoPriceRulePgRepository.inMemoryStore.values()).find(
      r => r.tenantId === tenantId && r.priceListId === priceListId && r.regionCode === regionCode
    );
    if (mem) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM geo_price_rules WHERE tenant_id = $1 AND price_list_id = $2 AND region_code = $3`,
      [tenantId, priceListId, regionCode],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findAll(tenantId: string): Promise<GeoPriceRule[]> {
    const memList = Array.from(GeoPriceRulePgRepository.inMemoryStore.values()).filter(r => r.tenantId === tenantId);
    if (memList.length > 0) return memList;

    const result = await this.db.query<any>(
      `SELECT * FROM geo_price_rules WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  private toDomain(row: any): GeoPriceRule {
    return new GeoPriceRule({
      id: row.id,
      tenantId: row.tenant_id,
      priceListId: row.price_list_id,
      regionCode: row.region_code,
      multiplier: Number(row.multiplier),
      priceAdjustmentCents: Number(row.price_adjustment_cents),
      status: row.status as GeoPriceRuleStatus,
      version: row.version,
    });
  }
}
