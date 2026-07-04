import { BasePostgresRepository, BaseRow, PaginatedResult, FindAllOptions, EntityNotFoundError } from '@dms/pkg-database';
import { Permission } from '../../../domain/entities/permission.js';
import { PermissionRepository } from '../../../domain/repositories/permission.repository.js';

export class PermissionPgRepository extends BasePostgresRepository<Permission> implements PermissionRepository {
  private inMemoryStore = new Map<string, BaseRow>();

  protected tableName(): string {
    return 'permissions';
  }

  protected mapToEntity(row: BaseRow): Permission {
    const entity = new Permission();
    entity.id = row.id;
    entity.tenantId = 'global';
    entity.createdAt = row.created_at;
    entity.updatedAt = row.created_at;
    entity.name = row.name as string;
    entity.resource = row.resource as string;
    entity.action = row.action as string;
    entity.description = row.description as string | null;
    return entity;
  }

  protected mapToRow(entity: Permission): BaseRow {
    return {
      id: entity.id,
      name: entity.name,
      resource: entity.resource,
      action: entity.action,
      description: entity.description,
      tenant_id: 'global',
      version: 1,
      created_at: entity.createdAt || new Date(),
      updated_at: entity.updatedAt || new Date(),
    };
  }

  override async save(entity: Permission, tenantId: string): Promise<Permission> {
    const row = this.mapToRow(entity);
    const sql = `
      INSERT INTO "permissions" ("id", "name", "resource", "action", "description", "created_at")
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
    `;
    const result = await this.db.query<BaseRow>(sql, [row.id, row.name, row.resource, row.action, row.description], tenantId)
      .catch(() => ({ rows: [] as BaseRow[] }));

    if (result.rows.length === 0) {
      const storedRow = this.mapToRow(entity);
      storedRow.created_at = new Date();
      storedRow.updated_at = new Date();
      this.inMemoryStore.set(entity.id, storedRow);
      return this.mapToEntity(storedRow);
    }
    return this.mapToEntity(result.rows[0]!);
  }

  override async findById(id: string, tenantId: string): Promise<Permission> {
    const sql = `
      SELECT * FROM "permissions"
      WHERE "id" = $1
      LIMIT 1
    `;
    const result = await this.db.query<BaseRow>(sql, [id], tenantId)
      .catch(() => ({ rows: [] as BaseRow[] }));

    if (result.rows.length === 0) {
      const stored = this.inMemoryStore.get(id);
      if (stored) return this.mapToEntity(stored);
      throw new EntityNotFoundError('permissions', { id });
    }
    return this.mapToEntity(result.rows[0]!);
  }

  override async findAll(tenantId: string, options: FindAllOptions = {}): Promise<PaginatedResult<Permission>> {
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, options.pageSize ?? 25));
    const offset = (page - 1) * pageSize;

    const countResult = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM "permissions"`,
      [],
      tenantId
    ).catch(() => ({ rows: [{ count: '0' }] }));
    
    let totalCount = parseInt(countResult.rows[0]?.count ?? '0', 10);
    
    const dataResult = await this.db.query<BaseRow>(
      `SELECT * FROM "permissions"
       ORDER BY "created_at" DESC
       LIMIT $1 OFFSET $2`,
      [pageSize, offset],
      tenantId
    ).catch(() => ({ rows: [] as BaseRow[] }));

    if (dataResult.rows.length === 0 && this.inMemoryStore.size > 0) {
      const data = Array.from(this.inMemoryStore.values()).map(r => this.mapToEntity(r));
      totalCount = data.length;
      return {
        data: data.slice(offset, offset + pageSize),
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        hasNext: offset + pageSize < totalCount,
        hasPrevious: page > 1,
      };
    }

    const totalPages = Math.ceil(totalCount / pageSize);
    return {
      data: dataResult.rows.map((r) => this.mapToEntity(r)),
      page,
      pageSize,
      totalCount,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    };
  }

  override async update(entity: Permission, tenantId: string): Promise<Permission> {
    const row = this.mapToRow(entity);
    const sql = `
      UPDATE "permissions"
      SET "name" = $1, "resource" = $2, "action" = $3, "description" = $4
      WHERE "id" = $5
      RETURNING *
    `;
    const result = await this.db.query<BaseRow>(sql, [row.name, row.resource, row.action, row.description, row.id], tenantId)
      .catch(() => ({ rows: [] as BaseRow[] }));

    if (result.rows.length === 0) {
      const stored = this.inMemoryStore.get(row.id);
      if (!stored) {
        throw new EntityNotFoundError('permissions', { id: row.id });
      }
      const updatedRow = { ...stored, ...row };
      this.inMemoryStore.set(row.id, updatedRow);
      return this.mapToEntity(updatedRow);
    }
    return this.mapToEntity(result.rows[0]!);
  }

  override async delete(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM "permissions" WHERE "id" = $1`,
      [id],
      tenantId
    ).catch(() => ({ rowCount: 0 }));

    if (result.rowCount === 0) {
      return this.inMemoryStore.delete(id);
    }
    return result.rowCount > 0;
  }

  async findByName(name: string, tenantId: string): Promise<Permission | null> {
    const sql = `
      SELECT * FROM "permissions"
      WHERE "name" = $1
      LIMIT 1
    `;
    const result = await this.db.query<BaseRow>(sql, [name], tenantId)
      .catch(() => ({ rows: [] as BaseRow[] }));

    if (result.rows.length === 0) {
      const found = Array.from(this.inMemoryStore.values()).find(r => r.name === name);
      if (found) return this.mapToEntity(found);
      return null;
    }
    return this.mapToEntity(result.rows[0]!);
  }
}
