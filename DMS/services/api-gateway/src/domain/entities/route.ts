/**
 * HTTP methods supported by the API gateway.
 */
export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
}

/**
 * Rate limit configuration for a route.
 */
export interface RateLimitConfig {
  readonly requestsPerMinute: number;
  readonly burstSize: number;
}

/**
 * Circuit breaker configuration for upstream service calls.
 */
export interface CircuitBreakerConfig {
  readonly enabled: boolean;
  readonly failureThreshold: number;
  readonly resetTimeoutMs: number;
}

/**
 * Route entity representing an API gateway route definition.
 * Maps incoming request paths to upstream service endpoints.
 */
export class Route {
  readonly id: string;
  readonly path: string;
  readonly method: HttpMethod;
  readonly targetService: string;
  readonly targetPath: string;
  readonly version: string;
  readonly isActive: boolean;
  readonly requiredPermissions: string[];
  readonly rateLimit: RateLimitConfig;
  readonly timeout: number;
  readonly retries: number;
  readonly circuitBreaker: CircuitBreakerConfig;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: {
    id: string;
    path: string;
    method: HttpMethod;
    targetService: string;
    targetPath: string;
    version: string;
    isActive: boolean;
    requiredPermissions: string[];
    rateLimit: RateLimitConfig;
    timeout: number;
    retries: number;
    circuitBreaker: CircuitBreakerConfig;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = props.id;
    this.path = props.path;
    this.method = props.method;
    this.targetService = props.targetService;
    this.targetPath = props.targetPath;
    this.version = props.version;
    this.isActive = props.isActive;
    this.requiredPermissions = Object.freeze([...props.requiredPermissions]) as string[];
    this.rateLimit = Object.freeze({ ...props.rateLimit });
    this.timeout = props.timeout;
    this.retries = props.retries;
    this.circuitBreaker = Object.freeze({ ...props.circuitBreaker });
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /**
   * Factory method to create a new Route entity.
   */
  static create(props: {
    id?: string;
    path: string;
    method: HttpMethod;
    targetService: string;
    targetPath: string;
    version?: string;
    isActive?: boolean;
    requiredPermissions?: string[];
    rateLimit?: Partial<RateLimitConfig>;
    timeout?: number;
    retries?: number;
    circuitBreaker?: Partial<CircuitBreakerConfig>;
  }): Route {
    const now = new Date();
    return new Route({
      id: props.id ?? crypto.randomUUID(),
      path: props.path,
      method: props.method,
      targetService: props.targetService,
      targetPath: props.targetPath,
      version: props.version ?? 'v1',
      isActive: props.isActive ?? true,
      requiredPermissions: props.requiredPermissions ?? [],
      rateLimit: {
        requestsPerMinute: props.rateLimit?.requestsPerMinute ?? 100,
        burstSize: props.rateLimit?.burstSize ?? 20,
      },
      timeout: props.timeout ?? 30_000,
      retries: props.retries ?? 3,
      circuitBreaker: {
        enabled: props.circuitBreaker?.enabled ?? true,
        failureThreshold: props.circuitBreaker?.failureThreshold ?? 5,
        resetTimeoutMs: props.circuitBreaker?.resetTimeoutMs ?? 30_000,
      },
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Returns a new Route with the specified properties updated.
   */
  update(props: {
    path?: string;
    method?: HttpMethod;
    targetService?: string;
    targetPath?: string;
    version?: string;
    requiredPermissions?: string[];
    rateLimit?: Partial<RateLimitConfig>;
    timeout?: number;
    retries?: number;
    circuitBreaker?: Partial<CircuitBreakerConfig>;
  }): Route {
    return new Route({
      id: this.id,
      path: props.path ?? this.path,
      method: props.method ?? this.method,
      targetService: props.targetService ?? this.targetService,
      targetPath: props.targetPath ?? this.targetPath,
      version: props.version ?? this.version,
      isActive: this.isActive,
      requiredPermissions: props.requiredPermissions ?? [...this.requiredPermissions],
      rateLimit: {
        requestsPerMinute: props.rateLimit?.requestsPerMinute ?? this.rateLimit.requestsPerMinute,
        burstSize: props.rateLimit?.burstSize ?? this.rateLimit.burstSize,
      },
      timeout: props.timeout ?? this.timeout,
      retries: props.retries ?? this.retries,
      circuitBreaker: {
        enabled: props.circuitBreaker?.enabled ?? this.circuitBreaker.enabled,
        failureThreshold: props.circuitBreaker?.failureThreshold ?? this.circuitBreaker.failureThreshold,
        resetTimeoutMs: props.circuitBreaker?.resetTimeoutMs ?? this.circuitBreaker.resetTimeoutMs,
      },
      createdAt: this.createdAt,
      updatedAt: new Date(),
    });
  }

  /**
   * Returns a new Route that is activated.
   */
  activate(): Route {
    return new Route({
      ...this.toPlain(),
      isActive: true,
      updatedAt: new Date(),
    });
  }

  /**
   * Returns a new Route that is deactivated.
   */
  deactivate(): Route {
    return new Route({
      ...this.toPlain(),
      isActive: false,
      updatedAt: new Date(),
    });
  }

  private toPlain() {
    return {
      id: this.id,
      path: this.path,
      method: this.method,
      targetService: this.targetService,
      targetPath: this.targetPath,
      version: this.version,
      isActive: this.isActive,
      requiredPermissions: [...this.requiredPermissions],
      rateLimit: { ...this.rateLimit },
      timeout: this.timeout,
      retries: this.retries,
      circuitBreaker: { ...this.circuitBreaker },
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
