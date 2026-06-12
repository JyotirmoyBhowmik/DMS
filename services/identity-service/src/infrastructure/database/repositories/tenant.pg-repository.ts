import { BasePostgresRepository, BaseRow, PostgresDatabaseClient, EntityNotFoundError, ConcurrencyError, FindAllOptions, PaginatedResult } from '@dms/pkg-database';
import { Tenant } from '../../../domain/entities/tenant.js';
import { TenantRepository } from '../../../domain/repositories/tenant.repository.js';

export class TenantPgRepository extends BasePostgresRepository<Tenant> implements TenantRepository {
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
      INSERT INTO "tenants" ("name", "status", "created_at", "updated_at")
      VALUES ($1, $2, NOW(), NOW())
      RETURNING *
    `;
    const result = await this.db.query<BaseRow>(sql, [entity.name, entity.status], tenantId);
    return this.mapToEntity(result.rows[0]!);
  }

  override async findById(id: string, tenantId: string): Promise<Tenant> {
    const sql = `
      SELECT * FROM "tenants"
      WHERE "id" = $1
      LIMIT 1
    `;
    const result = await this.db.query<BaseRow>(sql, [id], tenantId);
    if (result.rows.length === 0) {
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
    const result = await this.db.query<BaseRow>(sql, [entity.id, entity.name, entity.status], tenantId);
    if (result.rows.length === 0) {
      throw new ConcurrencyError(this.tableName(), entity.id);
    }
    return this.mapToEntity(result.rows[0]!);
  }

  override async delete(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM "tenants" WHERE "id" = $1`,
      [id],
      tenantId
    );
    return result.rowCount > 0;
  }

  override async findAll(tenantId: string, options: FindAllOptions = {}): Promise<PaginatedResult<Tenant>> {
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, options.pageSize ?? 25));
    const orderBy = (options.orderBy ?? 'created_at').replace(/[^a-zA-Z0-9_]/g, '');
    const orderDir = options.orderDirection === 'ASC' ? 'ASC' : 'DESC';
    const offset = (page - 1) * pageSize;

    // Build dynamic WHERE (no tenant_id filter since tenants table doesn't have it)
    const conditions: string[] = ['1=1'];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (options.where) {
      for (const [col, val] of Object.entries(options.where)) {
        conditions.push(`"${col.replace(/[^a-zA-Z0-9_]/g, '')}" = $${paramIdx}`);
        params.push(val);
        paramIdx++;
      }
    }

    const whereClause = conditions.join(' AND ');

    const countResult = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM "tenants" WHERE ${whereClause}`,
      params,
      tenantId
    );
    const totalCount = parseInt(countResult.rows[0]?.count ?? '0', 10);
    const totalPages = Math.ceil(totalCount / pageSize);

    const dataResult = await this.db.query<BaseRow>(
      `SELECT * FROM "tenants"
       WHERE ${whereClause}
       ORDER BY "${orderBy}" ${orderDir}
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, pageSize, offset],
      tenantId
    );

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
}
