import { PostgresDatabaseClient } from '../postgres/client.js';
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
export declare abstract class BasePostgresRepository<T> {
    protected readonly db: PostgresDatabaseClient;
    constructor(db: PostgresDatabaseClient);
    /** The database table this repository operates on (unquoted). */
    protected abstract tableName(): string;
    /** Map a raw DB row to a domain entity / value object. */
    protected abstract mapToEntity(row: BaseRow): T;
    /** Map a domain entity to a flat row object suitable for INSERT / UPDATE. */
    protected abstract mapToRow(entity: T): BaseRow;
    /**
     * Insert a new entity.  Sets `version = 1` and `created_at = NOW()`.
     */
    save(entity: T, tenantId: string): Promise<T>;
    /**
     * Find a single entity by its primary key, scoped to the tenant.
     * Throws `EntityNotFoundError` if no row is found.
     */
    findById(id: string, tenantId: string): Promise<T>;
    /**
     * Return a paginated list of entities for the given tenant.
     */
    findAll(tenantId: string, options?: FindAllOptions): Promise<PaginatedResult<T>>;
    /**
     * Update an entity with optimistic locking.
     * The caller must supply the entity's current `version`.  If the version
     * in the database does not match, a `ConcurrencyError` is thrown.
     */
    update(entity: T, tenantId: string): Promise<T>;
    /**
     * Soft- or hard-delete an entity by ID (hard delete by default).
     * Override in subclass for soft-delete semantics.
     */
    delete(id: string, tenantId: string): Promise<boolean>;
    /**
     * Sanitize a column name to prevent SQL injection in ORDER BY / WHERE
     * clauses that are built dynamically.
     */
    private sanitizeColumnName;
}
//# sourceMappingURL=base.repository.d.ts.map