import { PostgresDatabaseClient } from '../postgres/client.js';
import type { QueryResult } from '../postgres/client.js';
import {
  DatabaseError,
  EntityNotFoundError,
  ConcurrencyError,
} from '../errors.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PaginationOptions {
  /** 1-based page number. Default: 1 */
  page?: number;
  /** Number of items per page. Default: 25, max: 200 */
  pageSize?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface FindAllOptions extends PaginationOptions {
  /** Column to ORDER BY. Default: "created_at" */
  orderBy?: string;
  /** Sort direction. Default: "DESC" */
  orderDirection?: 'ASC' | 'DESC';
  /** Extra WHERE conditions as { column: value } map (AND-joined) */
  where?: Record<string, unknown>;
}

/**
 * The row representation of an entity as stored in Postgres.
 * Must include at minimum: id, tenant_id, version, created_at, updated_at.
 */
export interface BaseRow {
  id: string;
  tenant_id: string;
  version: number;
  created_at: Date;
  updated_at: Date;
  [key: string]: unknown;
}

// ─── Abstract Base Repository ─────────────────────────────────────────────────

/**
 * Generic base repository providing standard CRUD with:
 *  - Automatic tenant isolation (every query includes `tenant_id = $N`)
 *  - Optimistic locking via a `version` column
 *  - Parameterised queries (no string interpolation of values)
 *
 * Subclasses must implement:
 *  - `tableName()`     – returns the unquoted Postgres table name
 *  - `mapToEntity(row)` – converts a DB row into a domain entity
 *  - `mapToRow(entity)` – converts a domain entity into a row literal
 */
export abstract class BasePostgresRepository<T> {
  protected readonly db: PostgresDatabaseClient;

  constructor(db: PostgresDatabaseClient) {
    this.db = db;
  }

  // ── Abstract contract ───────────────────────────────────────────────────

  /** The database table this repository operates on (unquoted). */
  protected abstract tableName(): string;

  /** Map a raw DB row to a domain entity / value object. */
  protected abstract mapToEntity(row: BaseRow): T;

  /** Map a domain entity to a flat row object suitable for INSERT / UPDATE. */
  protected abstract mapToRow(entity: T): BaseRow;

  // ── CRUD ────────────────────────────────────────────────────────────────

  /**
   * Insert a new entity.  Sets `version = 1` and `created_at = NOW()`.
   */
  async save(entity: T, tenantId: string): Promise<T> {
    const row = this.mapToRow(entity);
    const columns = Object.keys(row).filter(
      (k) => k !== 'created_at' && k !== 'updated_at' && k !== 'version',
    );
    const placeholders = columns.map((_, i) => `$${i + 1}`);
    const values = columns.map((c) => (c === 'tenant_id' ? tenantId : row[c]));

    const allCols = [...columns, 'version', 'created_at', 'updated_at'];
    const allPlaceholders = [
      ...placeholders,
      '1',           // version
      'NOW()',       // created_at
      'NOW()',       // updated_at
    ];

    const sql = `
      INSERT INTO "${this.tableName()}" (${allCols.map((c) => `"${c}"`).join(', ')})
      VALUES (${allPlaceholders.join(', ')})
      RETURNING *
    `;

    const result = await this.db.query<BaseRow>(sql, values, tenantId);

    if (result.rows.length === 0) {
      throw new DatabaseError(
        `Failed to insert into ${this.tableName()}`,
        'INSERT_FAILED',
      );
    }

    return this.mapToEntity(result.rows[0]!);
  }

  /**
   * Find a single entity by its primary key, scoped to the tenant.
   * Throws `EntityNotFoundError` if no row is found.
   */
  async findById(id: string, tenantId: string): Promise<T> {
    const sql = `
      SELECT * FROM "${this.tableName()}"
      WHERE "id" = $1 AND "tenant_id" = $2
      LIMIT 1
    `;

    const result = await this.db.query<BaseRow>(sql, [id, tenantId], tenantId);

    if (result.rows.length === 0) {
      throw new EntityNotFoundError(this.tableName(), { id, tenantId });
    }

    return this.mapToEntity(result.rows[0]!);
  }

  /**
   * Return a paginated list of entities for the given tenant.
   */
  async findAll(
    tenantId: string,
    options: FindAllOptions = {},
  ): Promise<PaginatedResult<T>> {
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, options.pageSize ?? 25));
    const orderBy = this.sanitizeColumnName(options.orderBy ?? 'created_at');
    const orderDir = options.orderDirection === 'ASC' ? 'ASC' : 'DESC';
    const offset = (page - 1) * pageSize;

    // Build dynamic WHERE
    const conditions: string[] = ['"tenant_id" = $1'];
    const params: unknown[] = [tenantId];
    let paramIdx = 2;

    if (options.where) {
      for (const [col, val] of Object.entries(options.where)) {
        conditions.push(`"${this.sanitizeColumnName(col)}" = $${paramIdx}`);
        params.push(val);
        paramIdx++;
      }
    }

    const whereClause = conditions.join(' AND ');

    // Count
    const countResult = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM "${this.tableName()}" WHERE ${whereClause}`,
      params,
      tenantId,
    );
    const totalCount = parseInt(countResult.rows[0]?.count ?? '0', 10);
    const totalPages = Math.ceil(totalCount / pageSize);

    // Data
    const dataResult = await this.db.query<BaseRow>(
      `SELECT * FROM "${this.tableName()}"
       WHERE ${whereClause}
       ORDER BY "${orderBy}" ${orderDir}
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, pageSize, offset],
      tenantId,
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

  /**
   * Update an entity with optimistic locking.
   * The caller must supply the entity's current `version`.  If the version
   * in the database does not match, a `ConcurrencyError` is thrown.
   */
  async update(entity: T, tenantId: string): Promise<T> {
    const row = this.mapToRow(entity);
    const currentVersion = row.version;

    // Build SET clause – exclude id, tenant_id, created_at, version
    const skipCols = new Set(['id', 'tenant_id', 'created_at', 'version']);
    const setCols = Object.keys(row).filter((c) => !skipCols.has(c));
    let paramIdx = 1;
    const setParts: string[] = [];
    const params: unknown[] = [];

    for (const col of setCols) {
      if (col === 'updated_at') {
        setParts.push(`"updated_at" = NOW()`);
      } else {
        setParts.push(`"${col}" = $${paramIdx}`);
        params.push(row[col]);
        paramIdx++;
      }
    }

    // Bump version
    setParts.push(`"version" = "version" + 1`);

    const sql = `
      UPDATE "${this.tableName()}"
      SET ${setParts.join(', ')}
      WHERE "id" = $${paramIdx}
        AND "tenant_id" = $${paramIdx + 1}
        AND "version" = $${paramIdx + 2}
      RETURNING *
    `;

    params.push(row.id, tenantId, currentVersion);

    const result = await this.db.query<BaseRow>(sql, params, tenantId);

    if (result.rows.length === 0) {
      throw new ConcurrencyError(this.tableName(), row.id);
    }

    return this.mapToEntity(result.rows[0]!);
  }

  /**
   * Soft- or hard-delete an entity by ID (hard delete by default).
   * Override in subclass for soft-delete semantics.
   */
  async delete(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM "${this.tableName()}"
       WHERE "id" = $1 AND "tenant_id" = $2`,
      [id, tenantId],
      tenantId,
    );

    return result.rowCount > 0;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  /**
   * Sanitize a column name to prevent SQL injection in ORDER BY / WHERE
   * clauses that are built dynamically.
   */
  private sanitizeColumnName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_]/g, '');
  }
}
