import { KPIAchievement } from '../../../domain/entities/kpi-achievement.js';
import { KPIAchievementRepository } from '../../../domain/repositories/kpi-achievement.repository.js';
import { BaseRow } from '@dms/pkg-database';

export class KPIAchievementPgRepository implements KPIAchievementRepository {
  private static inMemoryDb = new Map<string, KPIAchievement>();

  constructor(private readonly db?: any) {}

  static clearStore(): void {
    KPIAchievementPgRepository.inMemoryDb.clear();
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

  async save(achievement: KPIAchievement, tenantId: string): Promise<KPIAchievement> {
    const isViable = await this.isDbViable();
    if (!isViable) {
      KPIAchievementPgRepository.inMemoryDb.set(achievement.id, achievement);
      return achievement;
    }

    const row = this.mapToRow(achievement);
    const existing = await this.findById(achievement.id, tenantId);

    if (existing) {
      if (existing.version !== achievement.version) {
        throw new Error(`Optimistic locking conflict: version mismatch. DB version ${existing.version}, requested version ${achievement.version}`);
      }

      const sql = `
        UPDATE kpi_achievements
        SET target_value = $1, achieved_value = $2, status = $3,
            updated_at = $4, version = version + 1
        WHERE id = $5 AND tenant_id = $6
      `;
      const params = [
        row.target_value,
        row.achieved_value,
        row.status,
        row.updated_at,
        row.id,
        row.tenant_id,
      ];
      await this.db.query(sql, params, tenantId);
    } else {
      const sql = `
        INSERT INTO kpi_achievements (
          id, tenant_id, agent_id, period_month, period_year,
          target_value, achieved_value, kpi_type, status,
          created_at, updated_at, version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `;
      const params = [
        row.id,
        row.tenant_id,
        row.agent_id,
        row.period_month,
        row.period_year,
        row.target_value,
        row.achieved_value,
        row.kpi_type,
        row.status,
        row.created_at,
        row.updated_at,
        row.version,
      ];
      try {
        await this.db.query(sql, params, tenantId);
      } catch (err: any) {
        if (err.message.includes('unique_constraint') || err.message.includes('uq_kpi_achievements_agent_period')) {
          throw new Error(`A KPI achievement target of type ${achievement.kpiType} already exists for agent ${achievement.agentId} in period ${achievement.periodYear}-${achievement.periodMonth}`);
        }
        throw err;
      }
    }

    return achievement;
  }

  async findById(id: string, tenantId: string): Promise<KPIAchievement | null> {
    const isViable = await this.isDbViable();
    if (!isViable) {
      const found = KPIAchievementPgRepository.inMemoryDb.get(id);
      if (found && found.tenantId === tenantId) {
        return found;
      }
      return null;
    }

    const sql = `SELECT * FROM kpi_achievements WHERE id = $1 AND tenant_id = $2`;
    const res = await this.db.query(sql, [id, tenantId], tenantId);
    if (!res || res.length === 0) return null;
    return this.mapToEntity(res[0]);
  }

  async findByAgentAndPeriod(
    agentId: string,
    periodMonth: number,
    periodYear: number,
    tenantId: string
  ): Promise<KPIAchievement[]> {
    const isViable = await this.isDbViable();
    if (!isViable) {
      return Array.from(KPIAchievementPgRepository.inMemoryDb.values())
        .filter(
          (c) =>
            c.tenantId === tenantId &&
            c.agentId === agentId &&
            c.periodMonth === periodMonth &&
            c.periodYear === periodYear
        );
    }

    const sql = `
      SELECT * FROM kpi_achievements
      WHERE agent_id = $1 AND period_month = $2 AND period_year = $3 AND tenant_id = $4
      ORDER BY created_at DESC
    `;
    const res = await this.db.query(sql, [agentId, periodMonth, periodYear, tenantId], tenantId);
    return res.map((r: any) => this.mapToEntity(r));
  }

  async findAll(tenantId: string, limit: number = 50, offset: number = 0): Promise<KPIAchievement[]> {
    const isViable = await this.isDbViable();
    if (!isViable) {
      return Array.from(KPIAchievementPgRepository.inMemoryDb.values())
        .filter((c) => c.tenantId === tenantId)
        .slice(offset, offset + limit);
    }

    const sql = `
      SELECT * FROM kpi_achievements
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
      KPIAchievementPgRepository.inMemoryDb.delete(id);
      return;
    }

    const sql = `DELETE FROM kpi_achievements WHERE id = $1 AND tenant_id = $2`;
    await this.db.query(sql, [id, tenantId], tenantId);
  }

  async count(tenantId: string): Promise<number> {
    const isViable = await this.isDbViable();
    if (!isViable) {
      return Array.from(KPIAchievementPgRepository.inMemoryDb.values())
        .filter((c) => c.tenantId === tenantId).length;
    }

    const sql = `SELECT COUNT(*) as count FROM kpi_achievements WHERE tenant_id = $1`;
    const res = await this.db.query(sql, [tenantId], tenantId);
    return Number(res[0]?.count ?? 0);
  }

  private mapToEntity(row: BaseRow): KPIAchievement {
    return KPIAchievement.fromPersistence({
      id: row.id as string,
      tenantId: row.tenant_id as string,
      agentId: row.agent_id as string,
      kpiType: row.kpi_type as string,
      periodMonth: Number(row.period_month),
      periodYear: Number(row.period_year),
      targetValue: Number(row.target_value),
      achievedValue: Number(row.achieved_value),
      status: row.status as any,
      createdAt: new Date(row.created_at as any),
      updatedAt: new Date(row.updated_at as any),
      version: Number(row.version),
    });
  }

  private mapToRow(entity: KPIAchievement): BaseRow {
    return {
      id: entity.id,
      tenant_id: entity.tenantId,
      agent_id: entity.agentId,
      kpi_type: entity.kpiType,
      period_month: entity.periodMonth,
      period_year: entity.periodYear,
      target_value: entity.targetValue,
      achieved_value: entity.achievedValue,
      status: entity.status,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
      version: entity.version,
    };
  }
}
