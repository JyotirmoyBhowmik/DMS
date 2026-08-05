import { BasePostgresRepository, BaseRow, PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { OutletProfile, OutletType, KycStatus, OutletProfileStatus } from '../../../domain/entities/outlet-profile.js';
import { OutletProfileRepository } from '../../../domain/repositories/outlet-profile.repository.js';
import { GeoPoint } from '../../../domain/value-objects/geo-point.js';
import { StructuredLogger } from '@dms/pkg-logger';
import { loadConfigSync } from '@dms/pkg-config';

const config = loadConfigSync();

class PgOutletProfileRepo extends BasePostgresRepository<OutletProfile> {
  async checkHealth() {
    return await this.db.checkHealth();
  }

  async query<T = unknown>(sql: string, params?: unknown[], tenantId?: string) {
    return await this.db.query<T>(sql, params, tenantId);
  }

  override tableName(): string {
    return 'outlet_profiles';
  }

  public override mapToEntity(row: BaseRow): OutletProfile {
    const geoCoords = GeoPoint.create(Number(row.geo_lat), Number(row.geo_lng));
    return OutletProfile.reconstitute({
      id: row.id,
      tenantId: row.tenant_id,
      outletName: row.outlet_name as string,
      outletType: row.outlet_type as OutletType,
      ownerName: row.owner_name as string,
      ownerPhone: row.owner_phone as string,
      address: row.address as string,
      geoCoords,
      kycStatus: row.kyc_status as KycStatus,
      status: row.status as OutletProfileStatus,
      createdAt: row.created_at ? new Date(row.created_at as any) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at as any) : new Date(),
      version: row.version || 1,
    });
  }

  protected mapToRow(entity: OutletProfile): BaseRow {
    return {
      id: entity.id,
      tenant_id: entity.tenantId,
      outlet_name: entity.outletName,
      outlet_type: entity.outletType,
      owner_name: entity.ownerName,
      owner_phone: entity.ownerPhone,
      address: entity.address,
      geo_lat: entity.geoCoords.latitude,
      geo_lng: entity.geoCoords.longitude,
      kyc_status: entity.kycStatus,
      status: entity.status,
      version: entity.version,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}

export class OutletProfilePgRepository implements OutletProfileRepository {
  private logger = new StructuredLogger('OutletProfilePgRepository');
  public static inMemoryDb: Map<string, OutletProfile> = new Map();
  private pgRepo: PgOutletProfileRepo;
  private hasDb = false;

  constructor(db?: PostgresDatabaseClient) {
    const activeDb = db ?? new PostgresDatabaseClient(config.db, new PgDriver());
    this.pgRepo = new PgOutletProfileRepo(activeDb);
    this.checkConnection().then(alive => {
      this.hasDb = alive;
    });
  }

  public static clearStore(): void {
    OutletProfilePgRepository.inMemoryDb.clear();
  }

  private async checkConnection(): Promise<boolean> {
    try {
      const res = await this.pgRepo.checkHealth();
      return res.status === 'HEALTHY';
    } catch {
      return false;
    }
  }

  async save(profile: OutletProfile): Promise<OutletProfile> {
    if (this.hasDb) {
      try {
        this.logger.info('Saving outlet-profile record to Postgres', { id: profile.id, tenantId: profile.tenantId });
        return await this.pgRepo.save(profile, profile.tenantId);
      } catch (err: any) {
        this.logger.warn('Failed to save to Postgres, falling back to memory', { error: err.message });
      }
    }
    OutletProfilePgRepository.inMemoryDb.set(profile.id, profile);
    return profile;
  }

  async findById(id: string, tenantId: string): Promise<OutletProfile | null> {
    if (this.hasDb) {
      try {
        this.logger.info('Querying outlet-profile by ID from Postgres', { id, tenantId });
        return await this.pgRepo.findById(id, tenantId);
      } catch (err: any) {
        this.logger.warn('Failed to fetch from Postgres, falling back to memory', { error: err.message });
      }
    }
    const match = OutletProfilePgRepository.inMemoryDb.get(id);
    if (match && match.tenantId === tenantId) {
      return match;
    }
    return null;
  }

  async findAll(tenantId: string): Promise<OutletProfile[]> {
    if (this.hasDb) {
      try {
        const res = await this.pgRepo.findAll(tenantId, { pageSize: 500 });
        return res.data;
      } catch (err: any) {
        this.logger.warn('Failed to findAll in Postgres, falling back to memory', { error: err.message });
      }
    }
    return Array.from(OutletProfilePgRepository.inMemoryDb.values()).filter(g => g.tenantId === tenantId);
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
    OutletProfilePgRepository.inMemoryDb.delete(id);
  }
}
