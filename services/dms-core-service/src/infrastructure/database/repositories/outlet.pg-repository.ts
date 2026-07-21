import { Outlet, OutletChannelType, OutletStatus } from '../../../domain/entities/outlet.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';

export class OutletPgRepository {
  private static inMemoryStore = new Map<string, Outlet>();

  static clearStore(): void {
    this.inMemoryStore.clear();
  }

  constructor(private db: PostgresDatabaseClient) {}

  async save(outlet: Outlet): Promise<void> {
    OutletPgRepository.inMemoryStore.set(outlet.id, outlet);
    const data = outlet.toJSON();
    await this.db.query(
      `INSERT INTO outlets
        (id, tenant_id, name, latitude, longitude, radius_meters, status, channel_type, address, owner_name, owner_phone, distributor_id, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (id) DO UPDATE SET
         name = $3, latitude = $4, longitude = $5, radius_meters = $6, status = $7,
         channel_type = $8, address = $9, owner_name = $10, owner_phone = $11,
         distributor_id = $12, version = $13`,
      [data.id, data.tenantId, data.name, data.latitude, data.longitude, data.radiusMeters,
       data.status, data.channelType, data.address ?? null, data.ownerName ?? null,
       data.ownerPhone ?? null, data.distributorId ?? null, data.version],
      outlet.tenantId
    );
  }

  async findById(tenantId: string, id: string): Promise<Outlet | null> {
    const mem = OutletPgRepository.inMemoryStore.get(id);
    if (mem && mem.tenantId === tenantId) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM outlets WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findByChannel(tenantId: string, channel: OutletChannelType): Promise<Outlet[]> {
    const memList = Array.from(OutletPgRepository.inMemoryStore.values()).filter(o => o.tenantId === tenantId && o.channelType === channel);
    if (memList.length > 0) return memList;

    const result = await this.db.query<any>(
      `SELECT * FROM outlets WHERE tenant_id = $1 AND channel_type = $2`,
      [tenantId, channel],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  async findByStatus(tenantId: string, status: OutletStatus): Promise<Outlet[]> {
    const memList = Array.from(OutletPgRepository.inMemoryStore.values()).filter(o => o.tenantId === tenantId && o.status === status);
    if (memList.length > 0) return memList;

    const result = await this.db.query<any>(
      `SELECT * FROM outlets WHERE tenant_id = $1 AND status = $2`,
      [tenantId, status],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  async findAll(tenantId: string): Promise<Outlet[]> {
    const memList = Array.from(OutletPgRepository.inMemoryStore.values()).filter(o => o.tenantId === tenantId);
    if (memList.length > 0) return memList;

    const result = await this.db.query<any>(
      `SELECT * FROM outlets WHERE tenant_id = $1 ORDER BY name`,
      [tenantId],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  private toDomain(row: any): Outlet {
    return new Outlet({
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      radiusMeters: Number(row.radius_meters ?? 50),
      status: row.status as OutletStatus,
      channelType: row.channel_type as OutletChannelType,
      address: row.address,
      ownerName: row.owner_name,
      ownerPhone: row.owner_phone,
      distributorId: row.distributor_id,
      version: row.version,
    });
  }
}
