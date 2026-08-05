/**
 * Base class for all database-layer errors.
 */
export class DatabaseError extends Error {
  public readonly code: string;
  public readonly cause?: Error;

  constructor(message: string, code = 'DB_ERROR', cause?: Error) {
    super(message);
    this.name = 'DatabaseError';
    this.code = code;
    this.cause = cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a query or lookup expects exactly one entity but
 * the database returns zero rows.
 */
export class EntityNotFoundError extends DatabaseError {
  public readonly entityName: string;
  public readonly criteria: Record<string, unknown>;

  constructor(entityName: string, criteria: Record<string, unknown>) {
    const msg = `${entityName} not found matching ${JSON.stringify(criteria)}`;
    super(msg, 'ENTITY_NOT_FOUND');
    this.name = 'EntityNotFoundError';
    this.entityName = entityName;
    this.criteria = criteria;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when an optimistic-concurrency check fails
 * (e.g. version mismatch during UPDATE … WHERE version = ?).
 */
export class ConcurrencyError extends DatabaseError {
  public readonly entityName: string;
  public readonly entityId: string;

  constructor(entityName: string, entityId: string) {
    const msg = `Concurrency conflict on ${entityName} id=${entityId}`;
    super(msg, 'CONCURRENCY_CONFLICT');
    this.name = 'ConcurrencyError';
    this.entityName = entityName;
    this.entityId = entityId;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
