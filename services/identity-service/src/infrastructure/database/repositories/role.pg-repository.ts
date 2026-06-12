import { BasePostgresRepository, BaseRow } from '@dms/pkg-database';
import { Role } from '../../../domain/entities/role.js';
import { RoleRepository } from '../../../domain/repositories/role.repository.js';

export class RolePgRepository extends BasePostgresRepository<Role> implements RoleRepository {
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

  async findByName(name: string, tenantId: string): Promise<Role | null> {
    const sql = `
      SELECT * FROM "roles"
      WHERE "name" = $1 AND "tenant_id" = $2
      LIMIT 1
    `;
    const result = await this.db.query<BaseRow>(sql, [name, tenantId], tenantId);
    if (result.rows.length === 0) {
      return null;
    }
    return this.mapToEntity(result.rows[0]!);
  }
}
