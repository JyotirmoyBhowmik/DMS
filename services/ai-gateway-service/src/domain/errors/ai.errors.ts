/**
 * Base class for all domain-specific errors in the AI Gateway service.
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

export class ModelNotFoundError extends DomainError {
  public readonly modelId: string;

  constructor(modelId: string) {
    super('MODEL_NOT_FOUND', `Model not found: ${modelId}`);
    this.modelId = modelId;
  }
}

export class InferenceTimeoutError extends DomainError {
  public readonly requestId: string;
  public readonly timeoutMs: number;

  constructor(requestId: string, timeoutMs: number) {
    super('INFERENCE_TIMEOUT', `Inference request ${requestId} timed out after ${timeoutMs}ms`);
    this.requestId = requestId;
    this.timeoutMs = timeoutMs;
  }
}

export class RateLimitError extends DomainError {
  public readonly tenantId: string;
  public readonly modelId: string;
  public readonly limit: number;

  constructor(tenantId: string, modelId: string, limit: number) {
    super(
      'RATE_LIMIT_EXCEEDED',
      `Rate limit exceeded for tenant ${tenantId} on model ${modelId}: max ${limit} requests/min`,
    );
    this.tenantId = tenantId;
    this.modelId = modelId;
    this.limit = limit;
  }
}

export class ProviderUnavailableError extends DomainError {
  public readonly provider: string;
  public readonly reason: string;

  constructor(provider: string, reason: string) {
    super('PROVIDER_UNAVAILABLE', `Provider ${provider} is unavailable: ${reason}`);
    this.provider = provider;
    this.reason = reason;
  }
}

export class TokenLimitExceededError extends DomainError {
  public readonly requested: number;
  public readonly max: number;

  constructor(requested: number, max: number) {
    super('TOKEN_LIMIT_EXCEEDED', `Token limit exceeded: requested ${requested}, max ${max}`);
    this.requested = requested;
    this.max = max;
  }
}

export class InvalidPromptError extends DomainError {
  public readonly reason: string;

  constructor(reason: string) {
    super('INVALID_PROMPT', `Invalid prompt: ${reason}`);
    this.reason = reason;
  }
}
