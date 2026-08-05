/**
 * Base error class for all API gateway domain errors.
 */
export class GatewayError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.name = 'GatewayError';
    this.code = code;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when no route matches the incoming request path and method.
 */
export class RouteNotFoundError extends GatewayError {
  readonly path: string;
  readonly method: string;

  constructor(path: string, method: string) {
    super(`No route found for ${method} ${path}`, 'ROUTE_NOT_FOUND', 404);
    this.name = 'RouteNotFoundError';
    this.path = path;
    this.method = method;
  }
}

/**
 * Thrown when the client has exceeded its rate limit.
 */
export class RateLimitExceededError extends GatewayError {
  readonly retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super(
      `Rate limit exceeded. Retry after ${Math.ceil(retryAfterMs / 1000)} seconds.`,
      'RATE_LIMIT_EXCEEDED',
      429,
    );
    this.name = 'RateLimitExceededError';
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Thrown when the upstream service does not respond within the configured timeout.
 */
export class UpstreamTimeoutError extends GatewayError {
  readonly targetService: string;
  readonly timeoutMs: number;

  constructor(targetService: string, timeoutMs: number) {
    super(
      `Upstream service '${targetService}' timed out after ${timeoutMs}ms`,
      'UPSTREAM_TIMEOUT',
      504,
    );
    this.name = 'UpstreamTimeoutError';
    this.targetService = targetService;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Thrown when the upstream service is unavailable (e.g., circuit breaker open).
 */
export class UpstreamUnavailableError extends GatewayError {
  readonly targetService: string;

  constructor(targetService: string) {
    super(
      `Upstream service '${targetService}' is currently unavailable`,
      'UPSTREAM_UNAVAILABLE',
      503,
    );
    this.name = 'UpstreamUnavailableError';
    this.targetService = targetService;
  }
}

/**
 * Thrown when the request requires authentication but none was provided.
 */
export class AuthenticationRequiredError extends GatewayError {
  constructor(reason: string = 'Authentication is required') {
    super(reason, 'AUTHENTICATION_REQUIRED', 401);
    this.name = 'AuthenticationRequiredError';
  }
}

/**
 * Thrown when an API key has expired.
 */
export class ApiKeyExpiredError extends GatewayError {
  readonly apiKeyId: string;

  constructor(apiKeyId: string) {
    super(`API key '${apiKeyId}' has expired`, 'API_KEY_EXPIRED', 401);
    this.name = 'ApiKeyExpiredError';
    this.apiKeyId = apiKeyId;
  }
}

/**
 * Thrown when the requested API version is deprecated and no longer supported.
 */
export class VersionDeprecatedError extends GatewayError {
  readonly version: string;

  constructor(version: string) {
    super(
      `API version '${version}' is deprecated and no longer supported`,
      'VERSION_DEPRECATED',
      410,
    );
    this.name = 'VersionDeprecatedError';
    this.version = version;
  }
}

/**
 * Thrown when the authenticated client lacks the required permissions.
 */
export class InsufficientPermissionsError extends GatewayError {
  readonly requiredPermissions: string[];

  constructor(requiredPermissions: string[]) {
    super(
      `Insufficient permissions. Required: ${requiredPermissions.join(', ')}`,
      'INSUFFICIENT_PERMISSIONS',
      403,
    );
    this.name = 'InsufficientPermissionsError';
    this.requiredPermissions = requiredPermissions;
  }
}
