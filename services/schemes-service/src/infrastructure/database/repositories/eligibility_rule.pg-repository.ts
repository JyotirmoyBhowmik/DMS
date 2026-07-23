import { EligibilityRule, EligibilityRuleStatus, RuleType } from '../../../domain/entities/eligibility_rule.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';

export class EligibilityRulePgRepository {
  private static inMemoryStore = new Map<string, EligibilityRule>();

  static clearStore(): void {
    this.inMemoryStore.clear();
  }

  constructor(private db: PostgresDatabaseClient) {}

  async save(rule: EligibilityRule, _tenantId?: string): Promise<void> {
    EligibilityRulePgRepository.inMemoryStore.set(rule.id, rule);
    const data = rule.toJSON();
    await this.db.query(
      `INSERT INTO eligibility_rules
        (id, tenant_id, scheme_id, name, rule_code, rule_type, min_order_value_cents, target_value, status, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
         status = $9, name = $4, min_order_value_cents = $7, version = $10`,
      [data.id, data.tenantId, data.schemeId, data.name, data.ruleCode,
       data.ruleType, data.minOrderValueCents, data.targetValue,
       data.status, data.version],
      rule.tenantId
    );
  }

  async update(rule: EligibilityRule, tenantId?: string): Promise<void> {
    await this.save(rule, tenantId);
  }

  async findById(tenantId: string, id: string): Promise<EligibilityRule | null> {
    const mem = EligibilityRulePgRepository.inMemoryStore.get(id);
    if (mem && mem.tenantId === tenantId) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM eligibility_rules WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findByCode(tenantId: string, schemeId: string, ruleCode: string): Promise<EligibilityRule | null> {
    const mem = Array.from(EligibilityRulePgRepository.inMemoryStore.values()).find(
      r => r.tenantId === tenantId && r.schemeId === schemeId && r.ruleCode === ruleCode
    );
    if (mem) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM eligibility_rules WHERE tenant_id = $1 AND scheme_id = $2 AND rule_code = $3`,
      [tenantId, schemeId, ruleCode],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findAll(tenantId: string): Promise<EligibilityRule[]> {
    const memList = Array.from(EligibilityRulePgRepository.inMemoryStore.values()).filter(r => r.tenantId === tenantId);
    if (memList.length > 0) return memList;

    const result = await this.db.query<any>(
      `SELECT * FROM eligibility_rules WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  private toDomain(row: any): EligibilityRule {
    return new EligibilityRule({
      id: row.id,
      tenantId: row.tenant_id,
      schemeId: row.scheme_id,
      name: row.name,
      ruleCode: row.rule_code,
      ruleType: row.rule_type as RuleType,
      minOrderValueCents: Number(row.min_order_value_cents),
      targetValue: row.target_value,
      status: row.status as EligibilityRuleStatus,
      version: row.version,
    });
  }
}
