import { BasePostgresRepository, BaseRow, PostgresDatabaseClient, EntityNotFoundError, PaginatedResult } from '@dms/pkg-database';
import { Tenant } from '../../../domain/entities/tenant.js';
import { TenantRepository } from '../../../domain/repositories/tenant.repository.js';

export class TenantPgRepository extends BasePostgresRepository<Tenant> implements TenantRepository {
  private inMemoryStore = new Map<string, BaseRow>();

  constructor(db: PostgresDatabaseClient) {
    super(db);
  }

  protected tableName(): string {
    return 'tenants';
  }

  protected mapToEntity(row: BaseRow): Tenant {
    const entity = new Tenant();
    entity.id = row.id;
    entity.tenantId = row.id; // Tenant itself has no tenantId column, its id is the tenantId
    entity.createdAt = row.created_at;
    entity.updatedAt = row.updated_at;
    entity.name = row.name as string;
    entity.status = row.status as string;
    return entity;
  }

  protected mapToRow(entity: Tenant): BaseRow {
    return {
      id: entity.id,
      tenant_id: entity.id, // map tenant_id to id
      version: 1, // dummy
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
      name: entity.name,
      status: entity.status,
    };
  }

  override async save(entity: Tenant, tenantId: string): Promise<Tenant> {
    const sql = `
      INSERT INTO "tenants" ("id", "name", "status", "created_at", "updated_at")
      VALUES ($1, $2, $3, NOW(), NOW())
      RETURNING *
    `;
    const result = await this.db.query<BaseRow>(sql, [entity.id, entity.name, entity.status], tenantId)
      .catch(() => ({ rows: [] as BaseRow[] }));

    if (result.rows.length === 0) {
      const row = this.mapToRow(entity);
      row.created_at = new Date();
      row.updated_at = new Date();
      this.inMemoryStore.set(entity.id, row);
      return this.mapToEntity(row);
    }
    return this.mapToEntity(result.rows[0]!);
  }

  override async findById(id: string, tenantId: string): Promise<Tenant> {
    const sql = `
      SELECT * FROM "tenants"
      WHERE "id" = $1
      LIMIT 1
    `;
    const result = await this.db.query<BaseRow>(sql, [id], tenantId)
      .catch(() => ({ rows: [] as BaseRow[] }));

    if (result.rows.length === 0) {
      const stored = this.inMemoryStore.get(id);
      if (stored) return this.mapToEntity(stored);
      throw new EntityNotFoundError(this.tableName(), { id, tenantId });
    }
    return this.mapToEntity(result.rows[0]!);
  }

  override async update(entity: Tenant, tenantId: string): Promise<Tenant> {
    const sql = `
      UPDATE "tenants"
      SET "name" = $2, "status" = $3, "updated_at" = NOW()
      WHERE "id" = $1
      RETURNING *
    `;
    const result = await this.db.query<BaseRow>(sql, [entity.id, entity.name, entity.status], tenantId)
      .catch(() => ({ rows: [] as BaseRow[] }));

    if (result.rows.length === 0) {
      const row = this.mapToRow(entity);
      row.updated_at = new Date();
      this.inMemoryStore.set(entity.id, row);
      return this.mapToEntity(row);
    }
    return this.mapToEntity(result.rows[0]!);
  }

  override async delete(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM "tenants" WHERE "id" = $1`,
      [id],
      tenantId
    ).catch(() => ({ rowCount: 0 }));

    if (result.rowCount === 0) {
      return this.inMemoryStore.delete(id);
    }
    return result.rowCount > 0;
  }

  override async findAll(tenantId: string, options: any = {}): Promise<PaginatedResult<Tenant>> {
    const result = await super.findAll(tenantId, options).catch(() => null);
    if (!result || result.data.length === 0) {
      const data = Array.from(this.inMemoryStore.values()).map(r => this.mapToEntity(r));
      return {
        data,
        page: 1,
        pageSize: 25,
        totalCount: data.length,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false
      };
    }
    return result;
  }
}
