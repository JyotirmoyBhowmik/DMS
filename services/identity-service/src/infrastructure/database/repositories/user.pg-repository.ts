import { BasePostgresRepository, BaseRow } from '@dms/pkg-database';
import { User } from '../../../domain/entities/user.js';
import { UserRepository } from '../../../domain/repositories/user.repository.js';

export class UserPgRepository extends BasePostgresRepository<User> implements UserRepository {
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

  async findByEmail(email: string, tenantId: string): Promise<User | null> {
    const sql = `
      SELECT * FROM "users"
      WHERE "email" = $1 AND "tenant_id" = $2
      LIMIT 1
    `;
    const result = await this.db.query<BaseRow>(sql, [email, tenantId], tenantId);
    if (result.rows.length === 0) {
      return null;
    }
    return this.mapToEntity(result.rows[0]!);
  }
}
