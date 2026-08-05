/**
 * Base class for all domain-specific errors in the DMS core service.
 */
export abstract class DomainError extends Error {
  public readonly code: string;

  protected constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BusinessRuleViolationError extends DomainError {
  constructor(message: string, code: string = 'BUSINESS_RULE_VIOLATION') {
    super(code, message);
  }
}

export class DuplicateDistributorError extends DomainError {
  constructor(name: string) {
    super('DUPLICATE_DISTRIBUTOR', `A distributor with the name '${name}' already exists.`);
  }
}

export class EntityNotFoundError extends DomainError {
  constructor(entityName: string, id: string) {
    super('ENTITY_NOT_FOUND', `${entityName} with ID '${id}' not found`);
  }
}

export class ConcurrencyConflictError extends DomainError {
  constructor(entityName: string, id: string) {
    super('CONCURRENCY_CONFLICT', `Concurrency conflict: ${entityName} with ID '${id}' has been updated by another process.`);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Access denied') {
    super('FORBIDDEN', message);
  }
}
