import { BasePostgresRepository, BaseRow, PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { OutletCensus, OutletType, KycStatus, OutletCensusStatus } from '../../../domain/entities/outlet-census.js';
import { OutletCensusRepository } from '../../../domain/repositories/outlet-census.repository.js';
import { GeoPoint } from '../../../domain/value-objects/geo-point.js';
import { StructuredLogger } from '@dms/pkg-logger';
import { loadConfigSync } from '@dms/pkg-config';

const config = loadConfigSync();

class PgOutletCensusRepo extends BasePostgresRepository<OutletCensus> {
  async checkHealth() {
    return await this.db.checkHealth();
  }

  async query<T = unknown>(sql: string, params?: unknown[], tenantId?: string) {
    return await this.db.query<T>(sql, params, tenantId);
  }

  override tableName(): string {
    return 'outlet_census';
  }

  public override mapToEntity(row: BaseRow): OutletCensus {
    const geoCoords = GeoPoint.create(Number(row.geo_lat), Number(row.geo_lng));
    
    let competitorPresenceObj: string[] = [];
    if (typeof row.competitor_presence === 'string') {
      try {
        competitorPresenceObj = JSON.parse(row.competitor_presence);
      } catch {}
    } else if (Array.isArray(row.competitor_presence)) {
      competitorPresenceObj = row.competitor_presence;
    }

    return OutletCensus.reconstitute({
      id: row.id,
      tenantId: row.tenant_id,
      outletId: row.outlet_id as string,
      agentId: row.agent_id as string,
      censusDate: row.census_date ? new Date(row.census_date as any).toISOString().split('T')[0]! : '',
      outletName: row.outlet_name as string,
      outletType: row.outlet_type as OutletType,
      ownerName: row.owner_name as string,
      ownerPhone: row.owner_phone as string,
      address: row.address as string,
      geoCoords,
      photoUrls: Array.isArray(row.photo_urls) ? row.photo_urls : [],
      kycStatus: row.kyc_status as KycStatus,
      gstin: row.gstin as string | null,
      panNumber: row.pan_number as string | null,
      tradeCategory: row.trade_category as string,
      annualTurnoverEstimate: Number(row.annual_turnover_estimate || 0),
      competitorPresence: competitorPresenceObj,
      status: row.status as OutletCensusStatus,
      createdAt: row.created_at ? new Date(row.created_at as any) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at as any) : new Date(),
      version: row.version || 0,
    });
  }

  protected mapToRow(entity: OutletCensus): BaseRow {
    return {
      id: entity.id,
      tenant_id: entity.tenantId,
      outlet_id: entity.outletId,
      agent_id: entity.agentId,
      census_date: entity.censusDate,
      outlet_name: entity.outletName,
      outlet_type: entity.outletType,
      owner_name: entity.ownerName,
      owner_phone: entity.ownerPhone,
      address: entity.address,
      geo_lat: entity.geoCoords.latitude,
      geo_lng: entity.geoCoords.longitude,
      photo_urls: [...entity.photoUrls],
      kyc_status: entity.kycStatus,
      gstin: entity.gstin,
      pan_number: entity.panNumber,
      trade_category: entity.tradeCategory,
      annual_turnover_estimate: entity.annualTurnoverEstimate,
      competitor_presence: JSON.stringify(entity.competitorPresence),
      status: entity.status,
      version: entity.version,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}

export class OutletCensusPgRepository implements OutletCensusRepository {
  private logger = new StructuredLogger('OutletCensusPgRepository');
  public static inMemoryDb: Map<string, OutletCensus> = new Map();
  private pgRepo: PgOutletCensusRepo;
  private hasDb = false;

  constructor(db?: PostgresDatabaseClient) {
    const activeDb = db ?? new PostgresDatabaseClient(config.db, new PgDriver());
    this.pgRepo = new PgOutletCensusRepo(activeDb);
    this.checkConnection().then(alive => {
      this.hasDb = alive;
    });
  }

  public static clearStore(): void {
    OutletCensusPgRepository.inMemoryDb.clear();
  }

  private async checkConnection(): Promise<boolean> {
    try {
      const res = await this.pgRepo.checkHealth();
      return res.status === 'HEALTHY';
    } catch {
      return false;
    }
  }

  async save(census: OutletCensus): Promise<OutletCensus> {
    if (this.hasDb) {
      try {
        this.logger.info('Saving outlet-census record to Postgres', { id: census.id, tenantId: census.tenantId });
        return await this.pgRepo.save(census, census.tenantId);
      } catch (err: any) {
        this.logger.warn('Failed to save to Postgres, falling back to memory', { error: err.message });
      }
    }
    OutletCensusPgRepository.inMemoryDb.set(census.id, census);
    return census;
  }

  async findById(id: string, tenantId: string): Promise<OutletCensus | null> {
    if (this.hasDb) {
      try {
        this.logger.info('Querying outlet-census by ID from Postgres', { id, tenantId });
        return await this.pgRepo.findById(id, tenantId);
      } catch (err: any) {
        this.logger.warn('Failed to fetch from Postgres, falling back to memory', { error: err.message });
      }
    }
    const match = OutletCensusPgRepository.inMemoryDb.get(id);
    if (match && match.tenantId === tenantId) {
      return match;
    }
    return null;
  }

  async findAll(tenantId: string): Promise<OutletCensus[]> {
    if (this.hasDb) {
      try {
        const res = await this.pgRepo.findAll(tenantId, { pageSize: 500 });
        return res.data;
      } catch (err: any) {
        this.logger.warn('Failed to findAll in Postgres, falling back to memory', { error: err.message });
      }
    }
    return Array.from(OutletCensusPgRepository.inMemoryDb.values()).filter(g => g.tenantId === tenantId);
  }

  async findByOutlet(outletId: string, tenantId: string): Promise<OutletCensus[]> {
    if (this.hasDb) {
      try {
        const sql = `SELECT * FROM "outlet_census" WHERE "outlet_id" = $1 AND "tenant_id" = $2`;
        const res = await this.pgRepo.query<BaseRow>(sql, [outletId, tenantId], tenantId);
        return res.rows.map(row => this.pgRepo.mapToEntity(row));
      } catch (err: any) {
        this.logger.warn('Failed to query by outlet from Postgres, falling back to memory', { error: err.message });
      }
    }
    return Array.from(OutletCensusPgRepository.inMemoryDb.values()).filter(
      g => g.outletId === outletId && g.tenantId === tenantId
    );
  }

  async findByAgent(agentId: string, tenantId: string): Promise<OutletCensus[]> {
    if (this.hasDb) {
      try {
        const sql = `SELECT * FROM "outlet_census" WHERE "agent_id" = $1 AND "tenant_id" = $2`;
        const res = await this.pgRepo.query<BaseRow>(sql, [agentId, tenantId], tenantId);
        return res.rows.map(row => this.pgRepo.mapToEntity(row));
      } catch (err: any) {
        this.logger.warn('Failed to query by agent from Postgres, falling back to memory', { error: err.message });
      }
    }
    return Array.from(OutletCensusPgRepository.inMemoryDb.values()).filter(
      g => g.agentId === agentId && g.tenantId === tenantId
    );
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
    OutletCensusPgRepository.inMemoryDb.delete(id);
  }
}
