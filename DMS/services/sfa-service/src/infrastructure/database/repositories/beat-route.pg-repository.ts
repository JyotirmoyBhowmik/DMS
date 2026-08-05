import { BasePostgresRepository, BaseRow, PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { BeatRoute, BeatOutlet, BeatRouteStatus, BeatRouteFrequency } from '../../../domain/entities/beat-route.js';
import { BeatRouteRepository } from '../../../domain/repositories/beat-route.repository.js';
import { StructuredLogger } from '@dms/pkg-logger';
import { loadConfigSync } from '@dms/pkg-config';

const config = loadConfigSync();

class PgBeatRouteRepo extends BasePostgresRepository<BeatRoute> {
  async checkHealth() {
    return await this.db.checkHealth();
  }

  async query<T = unknown>(sql: string, params?: unknown[], tenantId?: string) {
    return await this.db.query<T>(sql, params, tenantId);
  }

  override tableName(): string {
    return 'beat_routes';
  }

  public override mapToEntity(row: BaseRow): BeatRoute {
    let outlets: BeatOutlet[] = [];
    if (typeof row.outlets === 'string') {
      try {
        outlets = JSON.parse(row.outlets);
      } catch {
        outlets = [];
      }
    } else if (Array.isArray(row.outlets)) {
      outlets = row.outlets as any;
    }

    const cleanedOutlets: BeatOutlet[] = outlets.map((o: any) => ({
      outletId: o.outletId || o.outlet_id || '',
      sequence: Number(o.sequence || 0),
      lat: Number(o.lat || o.latitude || 0),
      lng: Number(o.lng || o.longitude || 0),
    }));

    return BeatRoute.reconstitute({
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name as string,
      region: row.region as string,
      assignedAgentIds: Array.isArray(row.assigned_agent_ids) ? row.assigned_agent_ids : [],
      outlets: cleanedOutlets,
      frequency: (row.frequency as string || 'daily').toLowerCase() as BeatRouteFrequency,
      status: (row.status as string || 'draft').toLowerCase() as BeatRouteStatus,
      isActive: !!row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      version: row.version,
    });
  }

  protected mapToRow(entity: BeatRoute): BaseRow {
    return {
      id: entity.id,
      tenant_id: entity.tenantId,
      name: entity.name,
      region: entity.region,
      assigned_agent_ids: [...entity.assignedAgentIds],
      outlets: JSON.stringify(entity.outlets.map((o: BeatOutlet) => ({
        outletId: o.outletId,
        sequence: o.sequence,
        lat: o.lat,
        lng: o.lng
      }))) as any,
      frequency: entity.frequency,
      status: entity.status,
      is_active: entity.isActive,
      version: entity.version,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}

export class BeatRoutePgRepository implements BeatRouteRepository {
  private logger = new StructuredLogger('BeatRoutePgRepository');
  public static inMemoryDb: Map<string, BeatRoute> = new Map();
  private pgRepo: PgBeatRouteRepo;
  private hasDb = false;

  constructor(db?: PostgresDatabaseClient) {
    const activeDb = db ?? new PostgresDatabaseClient(config.db, new PgDriver());
    this.pgRepo = new PgBeatRouteRepo(activeDb);
    this.checkConnection().then(alive => {
      this.hasDb = alive;
    });
  }

  public static clearStore(): void {
    BeatRoutePgRepository.inMemoryDb.clear();
  }

  private async checkConnection(): Promise<boolean> {
    try {
      const res = await this.pgRepo.checkHealth();
      return res.status === 'HEALTHY';
    } catch {
      return false;
    }
  }

  async save(beatRoute: BeatRoute): Promise<BeatRoute> {
    if (this.hasDb) {
      try {
        this.logger.info('Saving BeatRoute to Postgres', { beatRouteId: beatRoute.id });
        return await this.pgRepo.save(beatRoute, beatRoute.tenantId);
      } catch (err: any) {
        this.logger.warn('Failed to save to Postgres, falling back to memory', { error: err.message });
      }
    }
    BeatRoutePgRepository.inMemoryDb.set(beatRoute.id, beatRoute);
    return beatRoute;
  }

  async findById(id: string, tenantId: string): Promise<BeatRoute | null> {
    if (this.hasDb) {
      try {
        return await this.pgRepo.findById(id, tenantId);
      } catch (err: any) {
        this.logger.warn('Failed to find in Postgres, falling back to memory', { error: err.message });
      }
    }
    const match = BeatRoutePgRepository.inMemoryDb.get(id);
    if (match && match.tenantId === tenantId) {
      return match;
    }
    return null;
  }

  async findAll(tenantId: string): Promise<BeatRoute[]> {
    if (this.hasDb) {
      try {
        const res = await this.pgRepo.findAll(tenantId, { pageSize: 500 });
        return res.data;
      } catch (err: any) {
        this.logger.warn('Failed to findAll in Postgres, falling back to memory', { error: err.message });
      }
    }
    return Array.from(BeatRoutePgRepository.inMemoryDb.values()).filter(a => a.tenantId === tenantId);
  }

  async findByRegion(region: string, tenantId: string): Promise<BeatRoute[]> {
    if (this.hasDb) {
      try {
        const sql = `SELECT * FROM "beat_routes" WHERE "region" = $1 AND "tenant_id" = $2`;
        const res = await this.pgRepo.query<BaseRow>(sql, [region, tenantId], tenantId);
        return res.rows.map(row => this.pgRepo.mapToEntity(row));
      } catch (err: any) {
        this.logger.warn('Failed to findByRegion in Postgres, falling back to memory', { error: err.message });
      }
    }
    return Array.from(BeatRoutePgRepository.inMemoryDb.values()).filter(
      a => a.tenantId === tenantId && a.region === region
    );
  }

  async findByAgent(agentId: string, tenantId: string): Promise<BeatRoute[]> {
    if (this.hasDb) {
      try {
        const sql = `SELECT * FROM "beat_routes" WHERE $1 = ANY("assigned_agent_ids") AND "tenant_id" = $2`;
        const res = await this.pgRepo.query<BaseRow>(sql, [agentId, tenantId], tenantId);
        return res.rows.map(row => this.pgRepo.mapToEntity(row));
      } catch (err: any) {
        this.logger.warn('Failed to findByAgent in Postgres, falling back to memory', { error: err.message });
      }
    }
    return Array.from(BeatRoutePgRepository.inMemoryDb.values()).filter(
      a => a.tenantId === tenantId && a.assignedAgentIds.includes(agentId)
    );
  }

  async delete(id: string, tenantId: string): Promise<void> {
    if (this.hasDb) {
      try {
        await this.pgRepo.delete(id, tenantId);
        return;
      } catch (err: any) {
        this.logger.warn('Failed to delete in Postgres, falling back to memory', { error: err.message });
      }
    }
    BeatRoutePgRepository.inMemoryDb.delete(id);
  }
}
