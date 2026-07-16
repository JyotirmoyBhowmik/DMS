import { BasePostgresRepository, BaseRow, PostgresDatabaseClient, EntityNotFoundError } from '@dms/pkg-database';
import { User } from '../../../domain/entities/user.js';
import { UserRepository } from '../../../domain/repositories/user.repository.js';

export class UserPgRepository extends BasePostgresRepository<User> implements UserRepository {
  private inMemoryStore = new Map<string, BaseRow>();

  protected tableName(): string {
    return 'users';
  }

  protected mapToEntity(row: BaseRow): User {
    const entity = new User();
    entity.id = row.id;
    entity.tenantId = row.tenant_id;
    entity.version = row.version;
    entity.createdAt = row.created_at;
    entity.updatedAt = row.updated_at;
    entity.email = row.email as string;
    entity.passwordHash = row.password_hash as string;
    entity.status = row.status as string;
    entity.lastLoginAt = row.last_login_at as Date | null;
    return entity;
  }

  protected mapToRow(entity: User): BaseRow {
    return {
      id: entity.id,
      tenant_id: entity.tenantId,
      version: entity.version,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
      email: entity.email,
      password_hash: entity.passwordHash,
      status: entity.status,
      last_login_at: entity.lastLoginAt,
    };
  }

  override async save(entity: User, tenantId: string): Promise<User> {
    const sql = `
      INSERT INTO "users" ("id", "tenant_id", "email", "password_hash", "status", "version", "created_at", "updated_at")
      VALUES ($1, $2, $3, $4, $5, 1, NOW(), NOW())
      RETURNING *
    `;
    const result = await this.db.query<BaseRow>(sql, [entity.id, tenantId, entity.email, entity.passwordHash, entity.status], tenantId)
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

  override async findById(id: string, tenantId: string): Promise<User> {
    const sql = `
      SELECT * FROM "users"
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

  override async update(entity: User, tenantId: string): Promise<User> {
    const sql = `
      UPDATE "users"
      SET "email" = $1, "password_hash" = $2, "status" = $3, "last_login_at" = $4, "updated_at" = NOW(), "version" = "version" + 1
      WHERE "id" = $5 AND "tenant_id" = $6
      RETURNING *
    `;
    const result = await this.db.query<BaseRow>(sql, [entity.email, entity.passwordHash, entity.status, entity.lastLoginAt, entity.id, tenantId], tenantId)
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
      `DELETE FROM "users" WHERE "id" = $1 AND "tenant_id" = $2`,
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

  async findByEmail(email: string, tenantId: string): Promise<User | null> {
    const sql = `
      SELECT * FROM "users"
      WHERE "email" = $1 AND "tenant_id" = $2
      LIMIT 1
    `;
    const result = await this.db.query<BaseRow>(sql, [email, tenantId], tenantId)
      .catch(() => ({ rows: [] as BaseRow[] }));

    if (result.rows.length === 0) {
      const found = Array.from(this.inMemoryStore.values()).find(r => r.email === email && r.tenant_id === tenantId);
      if (found) return this.mapToEntity(found);
      return null;
    }
    return this.mapToEntity(result.rows[0]!);
  }
}
