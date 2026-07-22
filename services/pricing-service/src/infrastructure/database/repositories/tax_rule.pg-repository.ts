import { TaxRule, TaxRuleStatus, TaxCode } from '../../../domain/entities/tax_rule.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';

export class TaxRulePgRepository {
  private static inMemoryStore = new Map<string, TaxRule>();

  static clearStore(): void {
    this.inMemoryStore.clear();
  }

  constructor(private db: PostgresDatabaseClient) {}

  async save(rule: TaxRule, _tenantId?: string): Promise<void> {
    TaxRulePgRepository.inMemoryStore.set(rule.id, rule);
    const data = rule.toJSON();
    await this.db.query(
      `INSERT INTO tax_rules
        (id, tenant_id, name, tax_code, rate_percentage, status, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         status = $6, name = $3, rate_percentage = $5, version = $7`,
      [data.id, data.tenantId, data.name, data.taxCode, data.ratePercentage,
       data.status, data.version],
      rule.tenantId
    );
  }

  async update(rule: TaxRule, tenantId?: string): Promise<void> {
    await this.save(rule, tenantId);
  }

  async findById(tenantId: string, id: string): Promise<TaxRule | null> {
    const mem = TaxRulePgRepository.inMemoryStore.get(id);
    if (mem && mem.tenantId === tenantId) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM tax_rules WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findByCode(tenantId: string, taxCode: TaxCode): Promise<TaxRule | null> {
    const mem = Array.from(TaxRulePgRepository.inMemoryStore.values()).find(
      r => r.tenantId === tenantId && r.taxCode === taxCode
    );
    if (mem) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM tax_rules WHERE tenant_id = $1 AND tax_code = $2`,
      [tenantId, taxCode],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findAll(tenantId: string): Promise<TaxRule[]> {
    const memList = Array.from(TaxRulePgRepository.inMemoryStore.values()).filter(r => r.tenantId === tenantId);
    if (memList.length > 0) return memList;

    const result = await this.db.query<any>(
      `SELECT * FROM tax_rules WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  private toDomain(row: any): TaxRule {
    return new TaxRule({
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      taxCode: row.tax_code as TaxCode,
      ratePercentage: Number(row.rate_percentage),
      status: row.status as TaxRuleStatus,
      version: row.version,
    });
  }
}
