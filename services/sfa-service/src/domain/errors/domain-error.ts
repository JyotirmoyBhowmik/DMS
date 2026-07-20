/**
 * Base class for all domain-specific errors in the SFA service.
 * Carries a machine-readable `code` alongside the human message so that
 * upper layers can map errors to HTTP status codes or event payloads
 * without inspecting free-text.
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

export class InsufficientCreditError extends DomainError {
  public readonly outstanding: number;
  public readonly orderValue: number;
  public readonly limit: number;

  constructor(outstanding: number, orderValue: number, limit: number) {
    super(
      'INSUFFICIENT_CREDIT',
      `Credit limit exceeded: outstanding ${outstanding} + order ${orderValue} > limit ${limit}`,
    );
    this.outstanding = outstanding;
    this.orderValue = orderValue;
    this.limit = limit;
  }
}

export class EmptyOrderError extends DomainError {
  constructor() {
    super('EMPTY_ORDER', 'Order must contain at least one line item');
  }
}

export class InvalidVisitStateError extends DomainError {
  public readonly currentState: string;
  public readonly attemptedTransition: string;

  constructor(currentState: string, attemptedTransition: string) {
    super(
      'INVALID_VISIT_STATE',
      `Cannot transition visit from '${currentState}' to '${attemptedTransition}'`,
    );
    this.currentState = currentState;
    this.attemptedTransition = attemptedTransition;
  }
}

export class InvalidQuantityError extends DomainError {
  constructor(sku: string, qty: number) {
    super('INVALID_QUANTITY', `Quantity for SKU ${sku} must be positive, got ${qty}`);
  }
}

export class OrderAlreadyConfirmedError extends DomainError {
  constructor(orderId: string) {
    super('ORDER_ALREADY_CONFIRMED', `Order ${orderId} is already confirmed`);
  }
}

export class OrderAlreadyCancelledError extends DomainError {
  constructor(orderId: string) {
    super('ORDER_ALREADY_CANCELLED', `Order ${orderId} is already cancelled`);
  }
}

export class NegativeNetTotalError extends DomainError {
  constructor(netTotal: number) {
    super('NEGATIVE_NET_TOTAL', `Net total cannot be negative, computed: ${netTotal}`);
  }
}

export class MandatoryVisitStepMissingError extends DomainError {
  public readonly missingSteps: string[];

  constructor(missingSteps: string[]) {
    super(
      'MANDATORY_STEP_MISSING',
      `Mandatory visit steps not completed: ${missingSteps.join(', ')}`,
    );
    this.missingSteps = missingSteps;
  }
}

export class JourneyPlanConflictError extends DomainError {
  constructor(agentId: string, date: string) {
    super(
      'JOURNEY_PLAN_CONFLICT',
      `A journey plan already exists for agent ${agentId} on ${date}`,
    );
  }
}

export class InvalidDeliveryStateError extends DomainError {
  constructor(currentState: string, attemptedTransition: string) {
    super(
      'INVALID_DELIVERY_STATE',
      `Cannot transition delivery confirmation from '${currentState}' to '${attemptedTransition}'`,
    );
  }
}

export class InvalidAuditStateError extends DomainError {
  constructor(currentState: string, attemptedTransition: string) {
    super(
      'INVALID_AUDIT_STATE',
      `Cannot transition merchandising audit from '${currentState}' to '${attemptedTransition}'`,
    );
  }
}

export class InvalidCompetitorCaptureStateError extends DomainError {
  constructor(currentState: string, attemptedTransition: string) {
    super(
      'INVALID_COMPETITOR_CAPTURE_STATE',
      `Cannot transition competitor capture from '${currentState}' to '${attemptedTransition}'`,
    );
  }
}

export class InvalidPhotoCaptureStateError extends DomainError {
  constructor(currentState: string, attemptedTransition: string) {
    super(
      'INVALID_PHOTO_CAPTURE_STATE',
      `Cannot transition photo capture from '${currentState}' to '${attemptedTransition}'`,
    );
  }
}
