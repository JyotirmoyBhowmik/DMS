import { Scheme, SchemeStatus, SchemeType } from '../../../domain/entities/scheme.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';

export class SchemePgRepository {
  private static inMemoryStore = new Map<string, Scheme>();

  static clearStore(): void {
    this.inMemoryStore.clear();
  }

  constructor(private db: PostgresDatabaseClient) {}

  async save(scheme: Scheme, _tenantId?: string): Promise<void> {
    SchemePgRepository.inMemoryStore.set(scheme.id, scheme);
    const data = scheme.toJSON();
    await this.db.query(
      `INSERT INTO schemes
        (id, tenant_id, name, code, scheme_type, description, status, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         status = $7, name = $3, description = $6, version = $8`,
      [data.id, data.tenantId, data.name, data.code, data.schemeType,
       data.description, data.status, data.version],
      scheme.tenantId
    );
  }

  async update(scheme: Scheme, tenantId?: string): Promise<void> {
    await this.save(scheme, tenantId);
  }

  async findById(tenantId: string, id: string): Promise<Scheme | null> {
    const mem = SchemePgRepository.inMemoryStore.get(id);
    if (mem && mem.tenantId === tenantId) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM schemes WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findByCode(tenantId: string, code: string): Promise<Scheme | null> {
    const mem = Array.from(SchemePgRepository.inMemoryStore.values()).find(
      s => s.tenantId === tenantId && s.code === code
    );
    if (mem) return mem;

    const result = await this.db.query<any>(
      `SELECT * FROM schemes WHERE tenant_id = $1 AND code = $2`,
      [tenantId, code],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findAll(tenantId: string): Promise<Scheme[]> {
    const memList = Array.from(SchemePgRepository.inMemoryStore.values()).filter(s => s.tenantId === tenantId);
    if (memList.length > 0) return memList;

    const result = await this.db.query<any>(
      `SELECT * FROM schemes WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  private toDomain(row: any): Scheme {
    return new Scheme({
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      code: row.code,
      schemeType: row.scheme_type as SchemeType,
      description: row.description,
      status: row.status as SchemeStatus,
      version: row.version,
    });
  }
}
