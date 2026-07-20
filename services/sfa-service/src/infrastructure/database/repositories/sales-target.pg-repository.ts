import { SalesTarget } from '../../../domain/entities/sales-target.js';
import { SalesTargetRepository } from '../../../domain/repositories/sales-target.repository.js';
import { Money } from '../../../domain/value-objects/money.js';
import { BaseRow } from '@dms/pkg-database';

export class SalesTargetPgRepository implements SalesTargetRepository {
  private static inMemoryDb = new Map<string, SalesTarget>();

  constructor(private readonly db?: any) {}

  static clearStore(): void {
    SalesTargetPgRepository.inMemoryDb.clear();
  }

  private async isDbViable(): Promise<boolean> {
    if (!this.db) return false;
    try {
      await this.db.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async save(target: SalesTarget, tenantId: string): Promise<SalesTarget> {
    const isViable = await this.isDbViable();
    if (!isViable) {
      SalesTargetPgRepository.inMemoryDb.set(target.id, target);
      return target;
    }

    const row = this.mapToRow(target);
    const existing = await this.findById(target.id, tenantId);

    if (existing) {
      if (existing.version !== target.version) {
        throw new Error(`Optimistic locking conflict: version mismatch. DB version ${existing.version}, requested version ${target.version}`);
      }

      const sql = `
        UPDATE sales_targets
        SET target_amount = $1, achieved_amount = $2, status = $3,
            updated_at = $4, version = version + 1
        WHERE id = $5 AND tenant_id = $6
      `;
      const params = [
        row.target_amount,
        row.achieved_amount,
        row.status,
        row.updated_at,
        row.id,
        row.tenant_id,
      ];
      await this.db.query(sql, params, tenantId);
    } else {
      const sql = `
        INSERT INTO sales_targets (
          id, tenant_id, agent_id, period_month, period_year,
          target_amount, achieved_amount, target_type, status,
          created_at, updated_at, version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `;
      const params = [
        row.id,
        row.tenant_id,
        row.agent_id,
        row.period_month,
        row.period_year,
        row.target_amount,
        row.achieved_amount,
        row.target_type,
        row.status,
        row.created_at,
        row.updated_at,
        row.version,
      ];
      try {
        await this.db.query(sql, params, tenantId);
      } catch (err: any) {
        if (err.message.includes('unique_constraint') || err.message.includes('uq_sales_targets_agent_period')) {
          throw new Error(`A sales target of type ${target.targetType} already exists for agent ${target.agentId} in period ${target.periodYear}-${target.periodMonth}`);
        }
        throw err;
      }
    }

    return target;
  }

  async findById(id: string, tenantId: string): Promise<SalesTarget | null> {
    const isViable = await this.isDbViable();
    if (!isViable) {
      const found = SalesTargetPgRepository.inMemoryDb.get(id);
      if (found && found.tenantId === tenantId) {
        return found;
      }
      return null;
    }

    const sql = `SELECT * FROM sales_targets WHERE id = $1 AND tenant_id = $2`;
    const res = await this.db.query(sql, [id, tenantId], tenantId);
    if (!res || res.length === 0) return null;
    return this.mapToEntity(res[0]);
  }

  async findByAgentAndPeriod(
    agentId: string,
    periodMonth: number,
    periodYear: number,
    tenantId: string
  ): Promise<SalesTarget[]> {
    const isViable = await this.isDbViable();
    if (!isViable) {
      return Array.from(SalesTargetPgRepository.inMemoryDb.values())
        .filter(
          (c) =>
            c.tenantId === tenantId &&
            c.agentId === agentId &&
            c.periodMonth === periodMonth &&
            c.periodYear === periodYear
        );
    }

    const sql = `
      SELECT * FROM sales_targets
      WHERE agent_id = $1 AND period_month = $2 AND period_year = $3 AND tenant_id = $4
      ORDER BY created_at DESC
    `;
    const res = await this.db.query(sql, [agentId, periodMonth, periodYear, tenantId], tenantId);
    return res.map((r: any) => this.mapToEntity(r));
  }

  async findAll(tenantId: string, limit: number = 50, offset: number = 0): Promise<SalesTarget[]> {
    const isViable = await this.isDbViable();
    if (!isViable) {
      return Array.from(SalesTargetPgRepository.inMemoryDb.values())
        .filter((c) => c.tenantId === tenantId)
        .slice(offset, offset + limit);
    }

    const sql = `
      SELECT * FROM sales_targets
      WHERE tenant_id = $1
      ORDER BY period_year DESC, period_month DESC
      LIMIT $2 OFFSET $3
    `;
    const res = await this.db.query(sql, [tenantId, limit, offset], tenantId);
    return res.map((r: any) => this.mapToEntity(r));
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const isViable = await this.isDbViable();
    if (!isViable) {
      SalesTargetPgRepository.inMemoryDb.delete(id);
      return;
    }

    const sql = `DELETE FROM sales_targets WHERE id = $1 AND tenant_id = $2`;
    await this.db.query(sql, [id, tenantId], tenantId);
  }

  async count(tenantId: string): Promise<number> {
    const isViable = await this.isDbViable();
    if (!isViable) {
      return Array.from(SalesTargetPgRepository.inMemoryDb.values())
        .filter((c) => c.tenantId === tenantId).length;
    }

    const sql = `SELECT COUNT(*) as count FROM sales_targets WHERE tenant_id = $1`;
    const res = await this.db.query(sql, [tenantId], tenantId);
    return Number(res[0]?.count ?? 0);
  }

  private mapToEntity(row: BaseRow): SalesTarget {
    return SalesTarget.fromPersistence({
      id: row.id as string,
      tenantId: row.tenant_id as string,
      agentId: row.agent_id as string,
      periodMonth: Number(row.period_month),
      periodYear: Number(row.period_year),
      targetAmount: Money.fromCents(Math.round(parseFloat(row.target_amount as string) * 100)),
      achievedAmount: Money.fromCents(Math.round(parseFloat(row.achieved_amount as string) * 100)),
      targetType: row.target_type as string,
      status: row.status as any,
      createdAt: new Date(row.created_at as any),
      updatedAt: new Date(row.updated_at as any),
      version: Number(row.version),
    });
  }

  private mapToRow(entity: SalesTarget): BaseRow {
    return {
      id: entity.id,
      tenant_id: entity.tenantId,
      agent_id: entity.agentId,
      period_month: entity.periodMonth,
      period_year: entity.periodYear,
      target_amount: entity.targetAmount.amount,
      achieved_amount: entity.achievedAmount.amount,
      target_type: entity.targetType,
      status: entity.status,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
      version: entity.version,
    };
  }
}
