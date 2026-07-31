export abstract class ClaimDomainError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ClaimNotFoundError extends ClaimDomainError {
  readonly code = 'CLAIM_NOT_FOUND';
  readonly statusCode = 404;

  constructor(id: string) {
    super(`Claim with ID ${id} not found`);
  }
}

export class SettlementNotFoundError extends ClaimDomainError {
  readonly code = 'SETTLEMENT_NOT_FOUND';
  readonly statusCode = 404;

  constructor(id: string) {
    super(`Settlement with ID ${id} not found`);
  }
}

export class InvalidClaimStateError extends ClaimDomainError {
  readonly code = 'INVALID_CLAIM_STATE';
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
  }
}

export class OverClaimError extends ClaimDomainError {
  readonly code = 'OVER_CLAIM_DETECTED';
  readonly statusCode = 422;

  constructor(message: string) {
    super(message);
  }
}

export class ConcurrencyConflictError extends ClaimDomainError {
  readonly code = 'CONCURRENCY_CONFLICT';
  readonly statusCode = 409;

  constructor(message: string = 'Version conflict: stale update detected') {
    super(message);
  }
}

export class ForbiddenError extends ClaimDomainError {
  readonly code = 'FORBIDDEN';
  readonly statusCode = 403;

  constructor(message: string = 'Forbidden: Insufficient permissions') {
    super(message);
  }
}

export class BusinessRuleViolationError extends ClaimDomainError {
  readonly code = 'BUSINESS_RULE_VIOLATION';
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
  }
}
