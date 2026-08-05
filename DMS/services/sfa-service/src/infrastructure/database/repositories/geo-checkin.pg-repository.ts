import { BasePostgresRepository, BaseRow, PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { GeoCheckIn } from '../../../domain/entities/geo-checkin.js';
import { GeoCheckInRepository } from '../../../domain/repositories/geo-checkin.repository.js';
import { GeoPoint } from '../../../domain/value-objects/geo-point.js';
import { StructuredLogger } from '@dms/pkg-logger';
import { loadConfigSync } from '@dms/pkg-config';

const config = loadConfigSync();

class PgGeoCheckInRepo extends BasePostgresRepository<GeoCheckIn> {
  async checkHealth() {
    return await this.db.checkHealth();
  }

  async query<T = unknown>(sql: string, params?: unknown[], tenantId?: string) {
    return await this.db.query<T>(sql, params, tenantId);
  }

  override tableName(): string {
    return 'geo_checkins';
  }

  public override mapToEntity(row: BaseRow): GeoCheckIn {
    const checkInCoords = GeoPoint.create(Number(row.check_in_lat), Number(row.check_in_lng));
    
    const checkOutCoords = (row.check_out_lat != null && row.check_out_lng != null)
      ? GeoPoint.create(Number(row.check_out_lat), Number(row.check_out_lng))
      : null;

    let deviceInfoObj = { model: 'Unknown', os: 'Unknown', batteryLevel: 100 };
    if (typeof row.device_info === 'string') {
      try {
        deviceInfoObj = JSON.parse(row.device_info);
      } catch {}
    } else if (row.device_info && typeof row.device_info === 'object') {
      deviceInfoObj = row.device_info as any;
    }

    return GeoCheckIn.reconstitute({
      id: row.id,
      tenantId: row.tenant_id,
      agentId: row.agent_id as string,
      outletId: row.outlet_id as string,
      visitId: row.visit_id as string | null,
      checkInTime: row.check_in_time ? new Date(row.check_in_time as any) : new Date(),
      checkOutTime: row.check_out_time ? new Date(row.check_out_time as any) : null,
      checkInCoords,
      checkOutCoords,
      distanceFromOutlet: Number(row.distance_from_outlet || 0),
      isWithinGeofence: Boolean(row.is_within_geofence),
      spoofingDetected: Boolean(row.spoofing_detected),
      deviceInfo: deviceInfoObj,
      createdAt: row.created_at ? new Date(row.created_at as any) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at as any) : new Date(),
      version: row.version || 0,
    });
  }

  protected mapToRow(entity: GeoCheckIn): BaseRow {
    return {
      id: entity.id,
      tenant_id: entity.tenantId,
      agent_id: entity.agentId,
      outlet_id: entity.outletId,
      visit_id: entity.visitId,
      check_in_time: entity.checkInTime,
      check_out_time: entity.checkOutTime,
      check_in_lat: entity.checkInCoords.latitude,
      check_in_lng: entity.checkInCoords.longitude,
      check_out_lat: entity.checkOutCoords ? entity.checkOutCoords.latitude : null,
      check_out_lng: entity.checkOutCoords ? entity.checkOutCoords.longitude : null,
      distance_from_outlet: entity.distanceFromOutlet,
      is_within_geofence: entity.isWithinGeofence,
      spoofing_detected: entity.spoofingDetected,
      device_info: entity.deviceInfo as any,
      version: entity.version,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}

export class GeoCheckInPgRepository implements GeoCheckInRepository {
  private logger = new StructuredLogger('GeoCheckInPgRepository');
  public static inMemoryDb: Map<string, GeoCheckIn> = new Map();
  private pgRepo: PgGeoCheckInRepo;
  private hasDb = false;

  constructor(db?: PostgresDatabaseClient) {
    const activeDb = db ?? new PostgresDatabaseClient(config.db, new PgDriver());
    this.pgRepo = new PgGeoCheckInRepo(activeDb);
    this.checkConnection().then(alive => {
      this.hasDb = alive;
    });
  }

  public static clearStore(): void {
    GeoCheckInPgRepository.inMemoryDb.clear();
  }

  private async checkConnection(): Promise<boolean> {
    try {
      const res = await this.pgRepo.checkHealth();
      return res.status === 'HEALTHY';
    } catch {
      return false;
    }
  }

  async save(geoCheckIn: GeoCheckIn): Promise<GeoCheckIn> {
    if (this.hasDb) {
      try {
        this.logger.info('Saving geo-checkin record to Postgres', { id: geoCheckIn.id, tenantId: geoCheckIn.tenantId });
        return await this.pgRepo.save(geoCheckIn, geoCheckIn.tenantId);
      } catch (err: any) {
        this.logger.warn('Failed to save to Postgres, falling back to memory', { error: err.message });
      }
    }
    GeoCheckInPgRepository.inMemoryDb.set(geoCheckIn.id, geoCheckIn);
    return geoCheckIn;
  }

  async findById(id: string, tenantId: string): Promise<GeoCheckIn | null> {
    if (this.hasDb) {
      try {
        this.logger.info('Querying geo-checkin by ID from Postgres', { id, tenantId });
        return await this.pgRepo.findById(id, tenantId);
      } catch (err: any) {
        this.logger.warn('Failed to fetch from Postgres, falling back to memory', { error: err.message });
      }
    }
    const match = GeoCheckInPgRepository.inMemoryDb.get(id);
    if (match && match.tenantId === tenantId) {
      return match;
    }
    return null;
  }

  async findAll(tenantId: string): Promise<GeoCheckIn[]> {
    if (this.hasDb) {
      try {
        const res = await this.pgRepo.findAll(tenantId, { pageSize: 500 });
        return res.data;
      } catch (err: any) {
        this.logger.warn('Failed to findAll in Postgres, falling back to memory', { error: err.message });
      }
    }
    return Array.from(GeoCheckInPgRepository.inMemoryDb.values()).filter(g => g.tenantId === tenantId);
  }

  async findByAgent(agentId: string, tenantId: string): Promise<GeoCheckIn[]> {
    if (this.hasDb) {
      try {
        const sql = `SELECT * FROM "geo_checkins" WHERE "agent_id" = $1 AND "tenant_id" = $2`;
        const res = await this.pgRepo.query<BaseRow>(sql, [agentId, tenantId], tenantId);
        return res.rows.map(row => this.pgRepo.mapToEntity(row));
      } catch (err: any) {
        this.logger.warn('Failed to query by agent from Postgres, falling back to memory', { error: err.message });
      }
    }
    return Array.from(GeoCheckInPgRepository.inMemoryDb.values()).filter(
      g => g.agentId === agentId && g.tenantId === tenantId
    );
  }

  async findByOutlet(outletId: string, tenantId: string): Promise<GeoCheckIn[]> {
    if (this.hasDb) {
      try {
        const sql = `SELECT * FROM "geo_checkins" WHERE "outlet_id" = $1 AND "tenant_id" = $2`;
        const res = await this.pgRepo.query<BaseRow>(sql, [outletId, tenantId], tenantId);
        return res.rows.map(row => this.pgRepo.mapToEntity(row));
      } catch (err: any) {
        this.logger.warn('Failed to query by outlet from Postgres, falling back to memory', { error: err.message });
      }
    }
    return Array.from(GeoCheckInPgRepository.inMemoryDb.values()).filter(
      g => g.outletId === outletId && g.tenantId === tenantId
    );
  }

  async findByVisit(visitId: string, tenantId: string): Promise<GeoCheckIn | null> {
    if (this.hasDb) {
      try {
        const sql = `SELECT * FROM "geo_checkins" WHERE "visit_id" = $1 AND "tenant_id" = $2 LIMIT 1`;
        const res = await this.pgRepo.query<BaseRow>(sql, [visitId, tenantId], tenantId);
        if (res.rows.length > 0) {
          return this.pgRepo.mapToEntity(res.rows[0]!);
        }
        return null;
      } catch (err: any) {
        this.logger.warn('Failed to query by visit from Postgres, falling back to memory', { error: err.message });
      }
    }
    const match = Array.from(GeoCheckInPgRepository.inMemoryDb.values()).find(
      g => g.visitId === visitId && g.tenantId === tenantId
    );
    return match || null;
  }

  async delete(id: string, tenantId: string): Promise<void> {
    if (this.hasDb) {
      try {
        await this.pgRepo.delete(id, tenantId);
        return;
      } catch (err: any) {
        this.logger.warn('Failed to delete from Postgres, falling back to memory', { error: err.message });
      }
    }
    GeoCheckInPgRepository.inMemoryDb.delete(id);
  }
}
