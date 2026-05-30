import { Logger } from '@dms/pkg-logger';
import { HttpMethod } from '../../domain/entities/index.js';
import { GatewayAggregate } from '../../domain/aggregates/index.js';
import {
  GatewayError,
  RouteNotFoundError,
  AuthenticationRequiredError,
  UpstreamTimeoutError,
  UpstreamUnavailableError,
} from '../../domain/errors/index.js';
import type { IRouteRepository } from '../ports/route.repository.js';
import type { IApiKeyRepository } from '../ports/api_key.repository.js';
import type { IRateLimitStore } from '../ports/rate_limit.store.js';
import type { IUpstreamAdapter } from '../ports/upstream.adapter.js';

/**
 * Represents an incoming HTTP request to the gateway.
 */
export interface IncomingRequest {
  readonly method: string;
  readonly path: string;
  readonly headers: Record<string, string>;
  readonly body?: unknown;
  readonly clientIp: string;
}

/**
 * Represents the gateway's response to the client.
 */
export interface GatewayResponse {
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly body: unknown;
}

/**
 * Represents decoded JWT claims used for authentication.
 */
interface JwtClaims {
  sub: string;
  tenantId: string;
  permissions: string[];
  roles: string[];
}

/**
 * RouteRequestUseCase orchestrates the full lifecycle of an incoming gateway request:
 * 1. Route matching
 * 2. Authentication (API key or JWT)
 * 3. Permission validation
 * 4. Rate limit enforcement
 * 5. Upstream forwarding
 */
export class RouteRequestUseCase {
  private readonly routeRepository: IRouteRepository;
  private readonly apiKeyRepository: IApiKeyRepository;
  private readonly rateLimitStore: IRateLimitStore;
  private readonly upstreamAdapter: IUpstreamAdapter;
  private readonly logger: Logger;
  private readonly gateway: GatewayAggregate;
  private readonly jwtValidator: { validateToken(token: string): JwtClaims } | null;

  constructor(
    routeRepository: IRouteRepository,
    apiKeyRepository: IApiKeyRepository,
    rateLimitStore: IRateLimitStore,
    upstreamAdapter: IUpstreamAdapter,
    logger: Logger,
    jwtValidator?: { validateToken(token: string): JwtClaims },
  ) {
    this.routeRepository = routeRepository;
    this.apiKeyRepository = apiKeyRepository;
    this.rateLimitStore = rateLimitStore;
    this.upstreamAdapter = upstreamAdapter;
    this.logger = logger.child({ usecase: 'RouteRequestUseCase' });
    this.gateway = new GatewayAggregate();
    this.jwtValidator = jwtValidator ?? null;
  }

  async execute(request: IncomingRequest): Promise<GatewayResponse> {
    const startTime = Date.now();
    const method = request.method.toUpperCase() as HttpMethod;

    this.logger.info('Processing gateway request', {
      method,
      path: request.path,
      clientIp: request.clientIp,
    });

    // 1. Match route
    const route = await this.routeRepository.findByPathAndMethod(request.path, method);
    if (!route || !route.isActive) {
      throw new RouteNotFoundError(request.path, method);
    }

    // 2. Authenticate — check API key header first, then JWT bearer token
    let clientIdentifier: string;
    let clientPermissions: string[] = [];

    const apiKeyHeader = request.headers['x-api-key'] || request.headers['X-Api-Key'];
    const authHeader = request.headers['authorization'] || request.headers['Authorization'];

    if (apiKeyHeader) {
      // API key authentication
      const keyHash = await this.hashApiKey(apiKeyHeader);
      const apiKey = await this.apiKeyRepository.findByKeyHash(keyHash);
      if (!apiKey) {
        throw new AuthenticationRequiredError('Invalid API key');
      }
      this.gateway.validateApiKey(apiKey, route.requiredPermissions);
      clientIdentifier = `apikey:${apiKey.tenantId}`;
      clientPermissions = [...apiKey.permissions];

      // Mark the key as used (fire-and-forget)
      const updatedKey = apiKey.markUsed();
      this.apiKeyRepository.save(updatedKey).catch((err) => {
        this.logger.warn('Failed to update API key last used timestamp', {
          error: String(err),
        });
      });
    } else if (authHeader && authHeader.startsWith('Bearer ')) {
      // JWT authentication
      const token = authHeader.slice(7);
      if (!this.jwtValidator) {
        throw new AuthenticationRequiredError('JWT validation is not configured');
      }
      const claims = this.jwtValidator.validateToken(token);
      this.gateway.validateJwtPermissions(claims.permissions, route.requiredPermissions);
      clientIdentifier = `jwt:${claims.tenantId}:${claims.sub}`;
      clientPermissions = claims.permissions;
    } else if (route.requiredPermissions.length > 0) {
      // Route requires auth but none provided
      throw new AuthenticationRequiredError('No authentication credentials provided');
    } else {
      // Public route — no auth required
      clientIdentifier = `anon:${request.clientIp}`;
    }

    // 3. Enforce rate limiting
    const rateLimitKey = `${clientIdentifier}:${route.path}:${route.method}`;
    const windowSizeMs = 60_000; // 1 minute window
    const entry = await this.rateLimitStore.increment(rateLimitKey, windowSizeMs);
    this.gateway.enforceRateLimit(entry, route.rateLimit.requestsPerMinute);

    // 4. Build upstream request
    const targetUrl = `${route.targetService}${route.targetPath}`;
    const forwardHeaders: Record<string, string> = { ...request.headers };
    forwardHeaders['x-forwarded-for'] = request.clientIp;
    forwardHeaders['x-gateway-route-id'] = route.id;
    // Remove hop-by-hop headers
    delete forwardHeaders['host'];
    delete forwardHeaders['connection'];

    this.logger.debug('Forwarding to upstream', {
      targetService: route.targetService,
      targetPath: route.targetPath,
      timeout: route.timeout,
    });

    // 5. Forward to upstream
    try {
      const upstreamResponse = await this.upstreamAdapter.forward({
        method: route.method,
        url: targetUrl,
        headers: forwardHeaders,
        body: request.body,
        timeout: route.timeout,
      });

      const durationMs = Date.now() - startTime;
      this.logger.info('Request completed', {
        method,
        path: request.path,
        status: upstreamResponse.status,
        durationMs,
        upstreamDurationMs: upstreamResponse.durationMs,
      });

      return {
        status: upstreamResponse.status,
        headers: {
          ...upstreamResponse.headers,
          'x-gateway-duration-ms': String(durationMs),
          'x-gateway-route-id': route.id,
        },
        body: upstreamResponse.body,
      };
    } catch (error) {
      if (error instanceof GatewayError) {
        throw error;
      }
      const errMessage = error instanceof Error ? error.message : String(error);
      if (errMessage.includes('timeout') || errMessage.includes('ETIMEDOUT')) {
        throw new UpstreamTimeoutError(route.targetService, route.timeout);
      }
      throw new UpstreamUnavailableError(route.targetService);
    }
  }

  private async hashApiKey(rawKey: string): Promise<string> {
    const { createHash } = await import('node:crypto');
    return createHash('sha256').update(rawKey).digest('hex');
  }
}
