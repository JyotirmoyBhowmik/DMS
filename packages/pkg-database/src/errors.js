"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConcurrencyError = exports.EntityNotFoundError = exports.DatabaseError = void 0;
/**
 * Base class for all database-layer errors.
 */
class DatabaseError extends Error {
    code;
    cause;
    constructor(message, code = 'DB_ERROR', cause) {
        super(message);
        this.name = 'DatabaseError';
        this.code = code;
        this.cause = cause;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
exports.DatabaseError = DatabaseError;
/**
 * Thrown when a query or lookup expects exactly one entity but
 * the database returns zero rows.
 */
class EntityNotFoundError extends DatabaseError {
    entityName;
    criteria;
    constructor(entityName, criteria) {
        const msg = `${entityName} not found matching ${JSON.stringify(criteria)}`;
        super(msg, 'ENTITY_NOT_FOUND');
        this.name = 'EntityNotFoundError';
        this.entityName = entityName;
        this.criteria = criteria;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
exports.EntityNotFoundError = EntityNotFoundError;
/**
 * Thrown when an optimistic-concurrency check fails
 * (e.g. version mismatch during UPDATE … WHERE version = ?).
 */
class ConcurrencyError extends DatabaseError {
    entityName;
    entityId;
    constructor(entityName, entityId) {
        const msg = `Concurrency conflict on ${entityName} id=${entityId}`;
        super(msg, 'CONCURRENCY_CONFLICT');
        this.name = 'ConcurrencyError';
        this.entityName = entityName;
        this.entityId = entityId;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
exports.ConcurrencyError = ConcurrencyError;
//# sourceMappingURL=errors.js.map