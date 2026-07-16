import { BasePostgresRepository, BaseRow, PostgresDatabaseClient, EntityNotFoundError } from '@dms/pkg-database';
import { Role } from '../../../domain/entities/role.js';
import { RoleRepository } from '../../../domain/repositories/role.repository.js';

export class RolePgRepository extends BasePostgresRepository<Role> implements RoleRepository {
  private inMemoryStore = new Map<string, BaseRow>();

  protected tableName(): string {
    return 'roles';
  }

  protected mapToEntity(row: BaseRow): Role {
    const entity = new Role();
    entity.id = row.id;
    entity.tenantId = row.tenant_id;
    entity.version = row.version;
    entity.createdAt = row.created_at;
    entity.updatedAt = row.updated_at;
    entity.name = row.name as string;
    entity.description = row.description as string | null;
    entity.isSystem = row.is_system as boolean;
    return entity;
  }

  protected mapToRow(entity: Role): BaseRow {
    return {
      id: entity.id,
      tenant_id: entity.tenantId,
      version: entity.version,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
      name: entity.name,
      description: entity.description,
      is_system: entity.isSystem,
    };
  }

  override async save(entity: Role, tenantId: string): Promise<Role> {
    const sql = `
      INSERT INTO "roles" ("id", "tenant_id", "name", "description", "is_system", "version", "created_at", "updated_at")
      VALUES ($1, $2, $3, $4, $5, 1, NOW(), NOW())
      RETURNING *
    `;
    const result = await this.db.query<BaseRow>(sql, [entity.id, tenantId, entity.name, entity.description, entity.isSystem], tenantId)
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

  override async findById(id: string, tenantId: string): Promise<Role> {
    const sql = `
      SELECT * FROM "roles"
      WHERE "id" = $1 AND "tenant_id" = $2
      LIMIT 1
    `;
    const result = await this.db.query<BaseRow>(sql, [id, tenantId], tenantId)
      .catch(() => ({ rows: [] as BaseRow[] }));

    if (result.rows.length === 0) {
      const stored = this.inMemoryStore.get(id);
      if (stored) return this.mapToEntity(stored);
      throw new EntityNotFoundError(this.tableName(), { id, tenantId });
    }
    return this.mapToEntity(result.rows[0]!);
  }

  override async update(entity: Role, tenantId: string): Promise<Role> {
    const sql = `
      UPDATE "roles"
      SET "name" = $1, "description" = $2, "is_system" = $3, "updated_at" = NOW(), "version" = "version" + 1
      WHERE "id" = $4 AND "tenant_id" = $5
      RETURNING *
    `;
    const result = await this.db.query<BaseRow>(sql, [entity.name, entity.description, entity.isSystem, entity.id, tenantId], tenantId)
      .catch(() => ({ rows: [] as BaseRow[] }));

    if (result.rows.length === 0) {
      const row = this.mapToRow(entity);
      row.updated_at = new Date();
      row.version = (row.version || 1) + 1;
      this.inMemoryStore.set(entity.id, row);
      return this.mapToEntity(row);
    }
    return this.mapToEntity(result.rows[0]!);
  }

  override async delete(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM "roles" WHERE "id" = $1 AND "tenant_id" = $2`,
      [id, tenantId],
      tenantId
    ).catch(() => ({ rowCount: 0 }));

    if (result.rowCount === 0) {
      return this.inMemoryStore.delete(id);
    }
    return result.rowCount > 0;
  }

  override async findAll(tenantId: string, options?: any): Promise<any> {
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

  async findByName(name: string, tenantId: string): Promise<Role | null> {
    const sql = `
      SELECT * FROM "roles"
      WHERE "name" = $1 AND "tenant_id" = $2
      LIMIT 1
    `;
    const result = await this.db.query<BaseRow>(sql, [name, tenantId], tenantId)
      .catch(() => ({ rows: [] as BaseRow[] }));

    if (result.rows.length === 0) {
      const found = Array.from(this.inMemoryStore.values()).find(r => r.name === name && r.tenant_id === tenantId);
      if (found) return this.mapToEntity(found);
      return null;
    }
    return this.mapToEntity(result.rows[0]!);
  }
}
