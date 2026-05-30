import { randomUUID } from 'node:crypto';
import { TrieRouter, JwtValidator, ApiKeyValidator, RateLimitStore, InMemoryRouteRepository } from '../../../infrastructure/routing/trie_router.js';
import type { RouteHandler } from '../../../infrastructure/routing/trie_router.js';

interface GatewayRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: unknown;
}

interface GatewayResponse {
  status: number;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

export class GatewayController {
  private readonly router: TrieRouter;
  private readonly jwtValidator: JwtValidator;
  private readonly apiKeyValidator: ApiKeyValidator;
  private readonly rateLimitStore: RateLimitStore;
  private readonly routeRepo: InMemoryRouteRepository;

  constructor() {
    this.router = new TrieRouter();
    this.jwtValidator = new JwtValidator();
    this.apiKeyValidator = new ApiKeyValidator();
    this.rateLimitStore = new RateLimitStore(60_000);
    this.routeRepo = new InMemoryRouteRepository();

    this.registerRoutes();
  }

  private registerRoutes(): void {
    const routes = this.routeRepo.getAll();
    for (const route of routes) {
      const fullPath = `/api/v1${route.targetPath}`;
      this.router.insert('GET', fullPath, route);
      this.router.insert('POST', fullPath, route);
      this.router.insert('PUT', fullPath, route);
      this.router.insert('PATCH', fullPath, route);
      this.router.insert('DELETE', fullPath, route);
      // Also register with :id param
      this.router.insert('GET', `${fullPath}/:id`, route);
      this.router.insert('PUT', `${fullPath}/:id`, route);
      this.router.insert('PATCH', `${fullPath}/:id`, route);
      this.router.insert('DELETE', `${fullPath}/:id`, route);
    }
  }

  async handleRequest(request: GatewayRequest): Promise<GatewayResponse> {
    const requestId = request.headers['x-request-id'] ?? randomUUID();
    const responseHeaders: Record<string, string> = {
      'x-request-id': requestId,
      'x-gateway-version': 'v1.0.0',
    };

    // Route matching
    const matched = this.router.match(request.method, request.path);
    if (!matched) {
      return { status: 404, headers: responseHeaders, body: { error: 'Route not found', path: request.path, code: 'ROUTE_NOT_FOUND' } };
    }

    const { handler, params } = matched;

    // Authentication
    const authHeader = request.headers['authorization'] ?? request.headers['x-api-key'];
    if (!authHeader) {
      return { status: 401, headers: responseHeaders, body: { error: 'Authentication required', code: 'AUTH_REQUIRED' } };
    }

    let tenantId = request.headers['x-tenant-id'] ?? 'unknown';
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const validation = this.jwtValidator.validate(token);
      if (!validation.valid) {
        return { status: 401, headers: responseHeaders, body: { error: validation.error ?? 'Invalid token', code: 'INVALID_TOKEN' } };
      }
      tenantId = (validation.claims?.tenantId as string) ?? tenantId;
    }

    // Rate limiting
    const rateLimitKey = `${tenantId}:${handler.targetService}:${handler.targetPath}`;
    if (!this.rateLimitStore.tryAcquire(rateLimitKey, handler.rateLimit)) {
      const remaining = this.rateLimitStore.remaining(rateLimitKey, handler.rateLimit);
      responseHeaders['x-ratelimit-remaining'] = String(remaining);
      return { status: 429, headers: responseHeaders, body: { error: 'Rate limit exceeded', code: 'RATE_LIMIT_EXCEEDED' } };
    }

    responseHeaders['x-ratelimit-remaining'] = String(this.rateLimitStore.remaining(rateLimitKey, handler.rateLimit));

    // Forward to upstream (mock response)
    const upstreamResponse = this.forwardToUpstream(handler, request, params);
    return { status: 200, headers: { ...responseHeaders, 'x-upstream-service': handler.targetService }, body: upstreamResponse };
  }

  private forwardToUpstream(handler: RouteHandler, request: GatewayRequest, params: Record<string, string>): Record<string, unknown> {
    return {
      service: handler.targetService,
      path: handler.targetPath,
      method: request.method,
      params,
      message: `Request forwarded to ${handler.targetService} at ${handler.targetPath}`,
      timestamp: new Date().toISOString(),
    };
  }

  handleHealthCheck(): GatewayResponse {
    const services = this.routeRepo.getAll();
    const serviceNames = [...new Set(services.map((s: RouteHandler) => s.targetService))];
    return {
      status: 200,
      headers: {},
      body: {
        status: 'healthy',
        version: '1.0.0',
        uptime: process.uptime(),
        registeredRoutes: services.length,
        upstreamServices: serviceNames.map((name) => ({ name, status: 'healthy' })),
        timestamp: new Date().toISOString(),
      },
    };
  }

  handleListRoutes(): GatewayResponse {
    const routes = this.routeRepo.getAll();
    return {
      status: 200,
      headers: {},
      body: {
        routes: routes.map((r: RouteHandler) => ({
          id: r.routeId,
          service: r.targetService,
          path: r.targetPath,
          rateLimit: r.rateLimit,
          timeout: r.timeout,
        })),
        count: routes.length,
      },
    };
  }
}
