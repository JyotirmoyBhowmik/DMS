import { SchemeBudget, SchemeBudgetStatus } from '../../../domain/entities/scheme_budget.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';

export class SchemeBudgetPgRepository {
  private static inMemoryStore = new Map<string, SchemeBudget>();

  static clearStore(): void {
    this.inMemoryStore.clear();
  }

  constructor(private db: PostgresDatabaseClient) {}

  async save(budget: SchemeBudget, _tenantId?: string): Promise<void> {
    SchemeBudgetPgRepository.inMemoryStore.set(budget.id, budget);
    const data = budget.toJSON();
    await this.db.query(
      `INSERT INTO scheme_budgets
        (id, tenant_id, scheme_id, name, budget_code, total_allocated_cents, utilized_cents, status, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         status = $8, name = $4, total_allocated_cents = $6, utilized_cents = $7, version = $9`,
      [data.id, data.tenantId, data.schemeId, data.name, data.budgetCode,
       data.totalAllocatedCents, data.utilizedCents, data.status, data.version],
      budget.tenantId
    );
  }

  async update(budget: SchemeBudget, tenantId?: string): Promise<void> {
    await this.save(budget, tenantId);
  }

  async findById(tenantId: string, id: string): Promise<SchemeBudget | null> {
    const mem = SchemeBudgetPgRepository.inMemoryStore.get(id);
    if (mem && mem.tenantId === tenantId) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM scheme_budgets WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findByCode(tenantId: string, schemeId: string, budgetCode: string): Promise<SchemeBudget | null> {
    const mem = Array.from(SchemeBudgetPgRepository.inMemoryStore.values()).find(
      b => b.tenantId === tenantId && b.schemeId === schemeId && b.budgetCode === budgetCode
    );
    if (mem) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM scheme_budgets WHERE tenant_id = $1 AND scheme_id = $2 AND budget_code = $3`,
      [tenantId, schemeId, budgetCode],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findAll(tenantId: string): Promise<SchemeBudget[]> {
    const memList = Array.from(SchemeBudgetPgRepository.inMemoryStore.values()).filter(b => b.tenantId === tenantId);
    if (memList.length > 0) return memList;

    const result = await this.db.query<any>(
      `SELECT * FROM scheme_budgets WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  private toDomain(row: any): SchemeBudget {
    return new SchemeBudget({
      id: row.id,
      tenantId: row.tenant_id,
      schemeId: row.scheme_id,
      name: row.name,
      budgetCode: row.budget_code,
      totalAllocatedCents: Number(row.total_allocated_cents),
      utilizedCents: Number(row.utilized_cents),
      status: row.status as SchemeBudgetStatus,
      version: row.version,
    });
  }
}
