import { BasePostgresRepository, BaseRow, PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { Visit, VisitTask, VisitStatus } from '../../../domain/entities/visit.js';
import { VisitRepository as IVisitRepository } from '../../../domain/repositories/visit.repository.js';
import { GeoPoint } from '../../../domain/value-objects/geo-point.js';
import { StructuredLogger } from '@dms/pkg-logger';
import { loadConfigSync } from '@dms/pkg-config';

const config = loadConfigSync();

class PgVisitRepo extends BasePostgresRepository<Visit> {
  async checkHealth() {
    return await this.db.checkHealth();
  }

  async query<T = unknown>(sql: string, params?: unknown[], tenantId?: string) {
    return await this.db.query<T>(sql, params, tenantId);
  }

  override tableName(): string {
    return 'visits';
  }

  public override mapToEntity(row: BaseRow): Visit {
    let tasks: VisitTask[] = [];
    if (typeof row.tasks_completed === 'string') {
      try {
        tasks = JSON.parse(row.tasks_completed);
      } catch {
        tasks = [];
      }
    } else if (Array.isArray(row.tasks_completed)) {
      tasks = row.tasks_completed as any;
    }

    const cleanedTasks = tasks.map((t: any) => ({
      taskId: t.taskId || t.task_id || '',
      taskType: t.taskType || t.task_type || '',
      completedAt: new Date(t.completedAt || t.completed_at || new Date()),
      notes: t.notes || '',
    }));

    const checkInLocation = (row.geo_lat != null && row.geo_lng != null)
      ? GeoPoint.create(Number(row.geo_lat), Number(row.geo_lng))
      : null;

    const checkOutLocation = (row.checkout_geo_lat != null && row.checkout_geo_lng != null)
      ? GeoPoint.create(Number(row.checkout_geo_lat), Number(row.checkout_geo_lng))
      : null;

    return Visit.reconstitute({
      id: row.id,
      tenantId: row.tenant_id,
      agentId: row.agent_id as string,
      outletId: row.outlet_id as string,
      journeyPlanId: row.journey_plan_id as string,
      status: (row.status as string || 'planned').toLowerCase() as VisitStatus,
      checkInTime: row.check_in_time ? new Date(row.check_in_time as any) : null,
      checkOutTime: row.check_out_time ? new Date(row.check_out_time as any) : null,
      checkInLocation,
      checkOutLocation,
      tasksCompleted: cleanedTasks,
      plannedDate: row.created_at ? new Date(row.created_at as any) : new Date(),
      version: row.version || 0,
    });
  }

  protected mapToRow(entity: Visit): BaseRow {
    const tasks = entity.tasksCompleted.map(t => ({
      taskId: t.taskId,
      taskType: t.taskType,
      completedAt: t.completedAt.toISOString(),
      notes: t.notes,
    }));

    return {
      id: entity.id,
      tenant_id: entity.tenantId,
      agent_id: entity.agentId,
      outlet_id: entity.outletId,
      journey_plan_id: entity.journeyPlanId || null,
      status: entity.status.toUpperCase(),
      check_in_time: entity.checkInTime || null,
      check_out_time: entity.checkOutTime || null,
      geo_lat: entity.checkInLocation ? entity.checkInLocation.latitude : null,
      geo_lng: entity.checkInLocation ? entity.checkInLocation.longitude : null,
      checkout_geo_lat: entity.checkOutLocation ? entity.checkOutLocation.latitude : null,
      checkout_geo_lng: entity.checkOutLocation ? entity.checkOutLocation.longitude : null,
      tasks_completed: JSON.stringify(tasks) as any,
      version: entity.version,
      created_at: entity.plannedDate || new Date(),
      updated_at: new Date(),
    };
  }
}

export class VisitRepository implements IVisitRepository {
  private logger = new StructuredLogger('VisitRepository');
  public static inMemoryDb: Map<string, Visit> = new Map();
  private pgRepo: PgVisitRepo;
  private hasDb = false;

  constructor(db?: PostgresDatabaseClient) {
    const activeDb = db ?? new PostgresDatabaseClient(config.db, new PgDriver());
    this.pgRepo = new PgVisitRepo(activeDb);
    this.checkConnection().then(alive => {
      this.hasDb = alive;
    });
  }

  public static clearStore(): void {
    VisitRepository.inMemoryDb.clear();
  }

  private async checkConnection(): Promise<boolean> {
    try {
      const res = await this.pgRepo.checkHealth();
      return res.status === 'HEALTHY';
    } catch {
      return false;
    }
  }

  async save(visit: Visit): Promise<Visit> {
    if (this.hasDb) {
      try {
        this.logger.info('Saving visit record to Postgres', { visitId: visit.id, tenantId: visit.tenantId });
        return await this.pgRepo.save(visit, visit.tenantId);
      } catch (err: any) {
        this.logger.warn('Failed to save to Postgres, falling back to memory', { error: err.message });
      }
    }
    VisitRepository.inMemoryDb.set(visit.id, visit);
    return visit;
  }

  async findById(visitId: string, tenantId: string): Promise<Visit | null> {
    if (this.hasDb) {
      try {
        this.logger.info('Querying visit by identifier from Postgres', { visitId, tenantId });
        return await this.pgRepo.findById(visitId, tenantId);
      } catch (err: any) {
        this.logger.warn('Failed to fetch from Postgres, falling back to memory', { error: err.message });
      }
    }
    const match = VisitRepository.inMemoryDb.get(visitId);
    if (match && match.tenantId === tenantId) {
      return match;
    }
    return null;
  }

  async findByAgent(agentId: string, tenantId: string): Promise<Visit[]> {
    if (this.hasDb) {
      try {
        this.logger.info('Querying visits by agent from Postgres', { agentId, tenantId });
        const sql = `SELECT * FROM "visits" WHERE "agent_id" = $1 AND "tenant_id" = $2`;
        const res = await this.pgRepo.query<BaseRow>(sql, [agentId, tenantId], tenantId);
        return res.rows.map(row => this.pgRepo.mapToEntity(row));
      } catch (err: any) {
        this.logger.warn('Failed to query by agent from Postgres, falling back to memory', { error: err.message });
      }
    }
    return Array.from(VisitRepository.inMemoryDb.values()).filter(
      v => v.agentId === agentId && v.tenantId === tenantId
    );
  }

  async findAll(tenantId: string): Promise<Visit[]> {
    if (this.hasDb) {
      try {
        const res = await this.pgRepo.findAll(tenantId, { pageSize: 500 });
        return res.data;
      } catch (err: any) {
        this.logger.warn('Failed to findAll in Postgres, falling back to memory', { error: err.message });
      }
    }
    return Array.from(VisitRepository.inMemoryDb.values()).filter(v => v.tenantId === tenantId);
  }
}
