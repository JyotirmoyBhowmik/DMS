/**
 * Base class for all database-layer errors.
 */
export declare class DatabaseError extends Error {
    readonly code: string;
    readonly cause?: Error;
    constructor(message: string, code?: string, cause?: Error);
}
/**
 * Thrown when a query or lookup expects exactly one entity but
 * the database returns zero rows.
 */
export declare class EntityNotFoundError extends DatabaseError {
    readonly entityName: string;
    readonly criteria: Record<string, unknown>;
    constructor(entityName: string, criteria: Record<string, unknown>);
}
/**
 * Thrown when an optimistic-concurrency check fails
 * (e.g. version mismatch during UPDATE … WHERE version = ?).
 */
export declare class ConcurrencyError extends DatabaseError {
    readonly entityName: string;
    readonly entityId: string;
    constructor(entityName: string, entityId: string);
}
//# sourceMappingURL=errors.d.ts.map