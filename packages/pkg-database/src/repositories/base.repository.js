"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BasePostgresRepository = void 0;
const errors_js_1 = require("../errors.js");
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
class BasePostgresRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    // ── CRUD ────────────────────────────────────────────────────────────────
    /**
     * Insert a new entity.  Sets `version = 1` and `created_at = NOW()`.
     */
    async save(entity, tenantId) {
        const row = this.mapToRow(entity);
        const columns = Object.keys(row).filter((k) => k !== 'created_at' && k !== 'updated_at' && k !== 'version');
        const placeholders = columns.map((_, i) => `$${i + 1}`);
        const values = columns.map((c) => (c === 'tenant_id' ? tenantId : row[c]));
        const allCols = [...columns, 'version', 'created_at', 'updated_at'];
        const allPlaceholders = [
            ...placeholders,
            '1', // version
            'NOW()', // created_at
            'NOW()', // updated_at
        ];
        const sql = `
      INSERT INTO "${this.tableName()}" (${allCols.map((c) => `"${c}"`).join(', ')})
      VALUES (${allPlaceholders.join(', ')})
      RETURNING *
    `;
        const result = await this.db.query(sql, values, tenantId);
        if (result.rows.length === 0) {
            throw new errors_js_1.DatabaseError(`Failed to insert into ${this.tableName()}`, 'INSERT_FAILED');
        }
        return this.mapToEntity(result.rows[0]);
    }
    /**
     * Find a single entity by its primary key, scoped to the tenant.
     * Throws `EntityNotFoundError` if no row is found.
     */
    async findById(id, tenantId) {
        const sql = `
      SELECT * FROM "${this.tableName()}"
      WHERE "id" = $1 AND "tenant_id" = $2
      LIMIT 1
    `;
        const result = await this.db.query(sql, [id, tenantId], tenantId);
        if (result.rows.length === 0) {
            throw new errors_js_1.EntityNotFoundError(this.tableName(), { id, tenantId });
        }
        return this.mapToEntity(result.rows[0]);
    }
    /**
     * Return a paginated list of entities for the given tenant.
     */
    async findAll(tenantId, options = {}) {
        const page = Math.max(1, options.page ?? 1);
        const pageSize = Math.min(200, Math.max(1, options.pageSize ?? 25));
        const orderBy = this.sanitizeColumnName(options.orderBy ?? 'created_at');
        const orderDir = options.orderDirection === 'ASC' ? 'ASC' : 'DESC';
        const offset = (page - 1) * pageSize;
        // Build dynamic WHERE
        const conditions = ['"tenant_id" = $1'];
        const params = [tenantId];
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
        const countResult = await this.db.query(`SELECT COUNT(*) AS count FROM "${this.tableName()}" WHERE ${whereClause}`, params, tenantId);
        const totalCount = parseInt(countResult.rows[0]?.count ?? '0', 10);
        const totalPages = Math.ceil(totalCount / pageSize);
        // Data
        const dataResult = await this.db.query(`SELECT * FROM "${this.tableName()}"
       WHERE ${whereClause}
       ORDER BY "${orderBy}" ${orderDir}
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`, [...params, pageSize, offset], tenantId);
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
    async update(entity, tenantId) {
        const row = this.mapToRow(entity);
        const currentVersion = row.version;
        // Build SET clause – exclude id, tenant_id, created_at, version
        const skipCols = new Set(['id', 'tenant_id', 'created_at', 'version']);
        const setCols = Object.keys(row).filter((c) => !skipCols.has(c));
        let paramIdx = 1;
        const setParts = [];
        const params = [];
        for (const col of setCols) {
            if (col === 'updated_at') {
                setParts.push(`"updated_at" = NOW()`);
            }
            else {
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
        const result = await this.db.query(sql, params, tenantId);
        if (result.rows.length === 0) {
            throw new errors_js_1.ConcurrencyError(this.tableName(), row.id);
        }
        return this.mapToEntity(result.rows[0]);
    }
    /**
     * Soft- or hard-delete an entity by ID (hard delete by default).
     * Override in subclass for soft-delete semantics.
     */
    async delete(id, tenantId) {
        const result = await this.db.query(`DELETE FROM "${this.tableName()}"
       WHERE "id" = $1 AND "tenant_id" = $2`, [id, tenantId], tenantId);
        return result.rowCount > 0;
    }
    // ── Helpers ─────────────────────────────────────────────────────────────
    /**
     * Sanitize a column name to prevent SQL injection in ORDER BY / WHERE
     * clauses that are built dynamically.
     */
    sanitizeColumnName(name) {
        return name.replace(/[^a-zA-Z0-9_]/g, '');
    }
}
exports.BasePostgresRepository = BasePostgresRepository;
//# sourceMappingURL=base.repository.js.map