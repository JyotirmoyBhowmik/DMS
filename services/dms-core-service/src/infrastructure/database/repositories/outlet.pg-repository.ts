import { BasePostgresRepository, BaseRow, PostgresDatabaseClient, EntityNotFoundError } from '@dms/pkg-database';
import { Outlet } from '../../../domain/entities/outlet.js';
import { OutletRepository } from '../../../domain/repositories/outlet.repository.js';

export class OutletPgRepository extends BasePostgresRepository<Outlet> implements OutletRepository {
  constructor(db: PostgresDatabaseClient) {
    super(db);
  }

  protected tableName(): string {
    return 'retail_outlets';
  }

  protected mapToEntity(row: BaseRow): Outlet {
    return new Outlet(
      row.id as string,
      row.tenant_id as string,
      row.name as string,
      Number(row.latitude),
      Number(row.longitude),
      Number(row.radius_meters)
    );
  }

  protected mapToRow(entity: Outlet): BaseRow {
    return {
      id: entity.id,
      tenant_id: entity.tenantId,
      name: entity.name,
      latitude: entity.latitude,
      longitude: entity.longitude,
      radius_meters: entity.radiusMeters,
      version: 1,
      created_at: new Date(),
      updated_at: new Date(),
    };
  }

  async findNearby(lat: number, lng: number, radiusMeters: number, tenantId: string): Promise<Outlet[]> {
    // Simple bounding box or exact calculation based on Haversine in Postgres
    // For now, doing a basic lookup and filtering in-memory for exact distance is fine,
    // but ideally we'd use PostGIS. Since this is just retail_outlets, we can query all
    // or approximate.
    // For compliance with typical requirements without PostGIS:
    const sql = `SELECT * FROM "${this.tableName()}" WHERE "tenant_id" = $1`;
    const result = await this.db.query<BaseRow>(sql, [tenantId], tenantId);
    
    const outlets = result.rows.map(r => this.mapToEntity(r));
    return outlets.filter(o => o.isWithinGeofence(lat, lng).compliant);
  }
}
