import { BasePostgresRepository, BaseRow, PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { JourneyPlan, PlannedOutlet } from '../../../domain/entities/journey-plan.js';
import { StructuredLogger } from '@dms/pkg-logger';
import { loadConfigSync } from '@dms/pkg-config';

const config = loadConfigSync();

class PgJourneyPlanRepo extends BasePostgresRepository<JourneyPlan> {
  async checkHealth() {
    return await this.db.checkHealth();
  }

  async query<T = unknown>(sql: string, params?: unknown[], tenantId?: string) {
    return await this.db.query<T>(sql, params, tenantId);
  }

  override tableName(): string {
    return 'journey_plans';
  }

  public override mapToEntity(row: BaseRow): JourneyPlan {
    let planned: PlannedOutlet[] = [];
    if (typeof row.planned_outlets === 'string') {
      try {
        planned = JSON.parse(row.planned_outlets);
      } catch {
        planned = [];
      }
    } else if (Array.isArray(row.planned_outlets)) {
      planned = row.planned_outlets as any;
    }

    let visited: any[] = [];
    if (typeof row.visited_outlets === 'string') {
      try {
        visited = JSON.parse(row.visited_outlets);
      } catch {
        visited = [];
      }
    } else if (Array.isArray(row.visited_outlets)) {
      visited = row.visited_outlets as any;
    }

    const plannedOutlets: PlannedOutlet[] = planned.map((o: any) => ({
      outletId: o.outletId || o.outlet_id || '',
      outletName: o.outletName || o.outlet_name || '',
      sequence: Number(o.sequence || 0),
      latitude: Number(o.latitude || o.lat || 0),
      longitude: Number(o.longitude || o.lng || 0),
      estimatedArrival: new Date(o.estimatedArrival || o.estimated_arrival || new Date()),
      visited: o.visited || visited.some((v: any) => v.outletId === (o.outletId || o.outlet_id)),
    }));

    return JourneyPlan.reconstitute({
      id: row.id,
      tenantId: row.tenant_id,
      agentId: row.agent_id as string,
      date: (row.plan_date instanceof Date)
        ? row.plan_date.toISOString().split('T')[0]!
        : String(row.plan_date).split('T')[0]!,
      beatId: row.beat_id as string,
      beatName: (row.remarks as string) || 'Beat Plan',
      plannedOutlets,
      status: (row.status as string || 'PLANNED').toLowerCase() as any,
      actualStartTime: row.created_at,
      actualEndTime: row.updated_at,
      version: row.version,
    });
  }

  protected mapToRow(entity: JourneyPlan): BaseRow {
    const planned = entity.plannedOutlets.map(o => ({
      outletId: o.outletId,
      outletName: o.outletName,
      sequence: o.sequence,
      latitude: o.latitude,
      longitude: o.longitude,
      estimatedArrival: o.estimatedArrival.toISOString(),
      visited: o.visited
    }));

    const visited = entity.plannedOutlets.filter(o => o.visited).map(o => ({
      outletId: o.outletId,
      visitedAt: new Date().toISOString()
    }));

    return {
      id: entity.id,
      tenant_id: entity.tenantId,
      agent_id: entity.agentId,
      beat_id: entity.beatId,
      plan_date: entity.date as any,
      planned_outlets: JSON.stringify(planned) as any,
      visited_outlets: JSON.stringify(visited) as any,
      total_planned: entity.plannedOutlets.length,
      total_visited: entity.plannedOutlets.filter(o => o.visited).length,
      status: entity.status.toUpperCase(),
      remarks: entity.beatName || null,
      version: entity.version,
      created_at: entity.actualStartTime || new Date(),
      updated_at: entity.actualEndTime || new Date(),
    };
  }
}

export class JourneyPlanRepository {
  private logger = new StructuredLogger('JourneyPlanRepository');
  public static inMemoryDb: Map<string, JourneyPlan> = new Map();
  private pgRepo: PgJourneyPlanRepo;
  private hasDb = false;

  constructor(db?: PostgresDatabaseClient) {
    const activeDb = db ?? new PostgresDatabaseClient(config.db, new PgDriver());
    this.pgRepo = new PgJourneyPlanRepo(activeDb);
    this.checkConnection().then(alive => {
      this.hasDb = alive;
    });
  }

  public static clearStore(): void {
    JourneyPlanRepository.inMemoryDb.clear();
  }

  private async checkConnection(): Promise<boolean> {
    try {
      const res = await this.pgRepo.checkHealth();
      return res.status === 'HEALTHY';
    } catch {
      return false;
    }
  }

  async save(plan: JourneyPlan): Promise<JourneyPlan> {
    if (this.hasDb) {
      try {
        this.logger.info('Saving journey plan to Postgres', { planId: plan.id });
        return await this.pgRepo.save(plan, plan.tenantId);
      } catch (err: any) {
        this.logger.warn('Failed to save to Postgres, falling back to memory', { error: err.message });
      }
    }
    JourneyPlanRepository.inMemoryDb.set(plan.id, plan);
    return plan;
  }

  async updatePlan(plan: JourneyPlan): Promise<JourneyPlan> {
    if (this.hasDb) {
      try {
        this.logger.info('Updating journey plan in Postgres', { planId: plan.id });
        return await this.pgRepo.update(plan, plan.tenantId);
      } catch (err: any) {
        this.logger.warn('Failed to update in Postgres, falling back to memory', { error: err.message });
      }
    }
    JourneyPlanRepository.inMemoryDb.set(plan.id, plan);
    return plan;
  }

  async findById(planId: string, tenantId: string): Promise<JourneyPlan | null> {
    if (this.hasDb) {
      try {
        return await this.pgRepo.findById(planId, tenantId);
      } catch (err: any) {
        this.logger.warn('Failed to fetch from Postgres, falling back to memory', { error: err.message });
      }
    }
    const match = JourneyPlanRepository.inMemoryDb.get(planId);
    if (match && match.tenantId === tenantId) {
      return match;
    }
    return null;
  }

  async findAll(tenantId: string): Promise<JourneyPlan[]> {
    if (this.hasDb) {
      try {
        const result = await this.pgRepo.findAll(tenantId, { pageSize: 200 });
        return result.data;
      } catch (err: any) {
        this.logger.warn('Postgres findAll failed, falling back to memory', { error: err.message });
      }
    }
    return Array.from(JourneyPlanRepository.inMemoryDb.values()).filter(a => a.tenantId === tenantId);
  }

  async findByAgentAndDate(agentId: string, date: string, tenantId: string): Promise<JourneyPlan | null> {
    if (this.hasDb) {
      try {
        const sql = `
          SELECT * FROM "${this.pgRepo.tableName()}"
          WHERE "agent_id" = $1 AND "plan_date" = $2 AND "tenant_id" = $3
          LIMIT 1
        `;
        const result = await this.pgRepo.query<BaseRow>(sql, [agentId, date, tenantId], tenantId);
        if (result.rows.length > 0) {
          return this.pgRepo.mapToEntity(result.rows[0]!);
        }
      } catch (err: any) {
        this.logger.warn('Failed to query by agent and date from Postgres, falling back to memory', { error: err.message });
      }
    }
    for (const plan of JourneyPlanRepository.inMemoryDb.values()) {
      if (plan.agentId === agentId && plan.date === date && plan.tenantId === tenantId) {
        return plan;
      }
    }
    return null;
  }
}
