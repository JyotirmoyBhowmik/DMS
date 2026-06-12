import { randomUUID } from 'node:crypto';
import { TrieRouter, ApiKeyValidator, RateLimitStore, InMemoryRouteRepository } from '../../../infrastructure/routing/trie_router.js';
import type { RouteHandler } from '../../../infrastructure/routing/trie_router.js';
import { JwtAuthMiddleware } from '../../../middleware/auth.js';
import { RbacGuard } from '@dms/pkg-rbac';
import { AuditController } from '../../../../../audit-service/src/presentation/rest/controllers/audit.controller.js';
import { KeyManager } from '../../../../../identity-service/src/application/usecases/key_manager.js';
import { loadConfigSync } from '@dms/pkg-config';
import { OrderController } from '../../../../../sfa-service/src/presentation/rest/controllers/order.controller.js';
import { SchemeController } from '../../../../../schemes-service/src/presentation/rest/controllers/scheme.controller.js';
import { EnterpriseDmsController } from '../../../../../dms-core-service/src/presentation/rest/controllers/enterprise_dms.controller.js';
import { DistributorOnboardingController } from '../../../../../dms-core-service/src/presentation/rest/controllers/distributor-onboarding.controller.js';
import { DistributorOnboardingUseCases } from '../../../../../dms-core-service/src/application/usecases/distributor-onboarding/distributor-onboarding.usecases.js';
import { DistributorOnboardingPgRepository } from '../../../../../dms-core-service/src/infrastructure/database/repositories/distributor-onboarding.pg-repository.js';
import { PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';

const config = loadConfigSync();

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
  private readonly jwtAuth: JwtAuthMiddleware;
  private readonly apiKeyValidator: ApiKeyValidator;
  private readonly rateLimitStore: RateLimitStore;
  private readonly routeRepo: InMemoryRouteRepository;
  private readonly sfaOrderController: OrderController;
  private readonly schemesController: SchemeController;
  private readonly enterpriseDmsController: EnterpriseDmsController;
  private readonly distributorOnboardingController: DistributorOnboardingController;

  constructor() {
    this.router = new TrieRouter();
    this.jwtAuth = new JwtAuthMiddleware({
      publicKeyResolver: (kid: string) => {
        return KeyManager.getInstance().getPublicKey(kid);
      },
      audience: config.security.jwtAudience,
      issuer: config.security.jwtIssuer,
    });
    this.apiKeyValidator = new ApiKeyValidator();
    this.rateLimitStore = new RateLimitStore(60_000);
    this.routeRepo = new InMemoryRouteRepository();
    this.sfaOrderController = new OrderController();
    this.schemesController = new SchemeController();

    const db = new PostgresDatabaseClient(config.db, new PgDriver());
    const onboardingRepo = new DistributorOnboardingPgRepository(db);
    const onboardingUseCases = new DistributorOnboardingUseCases(onboardingRepo, db);
    this.distributorOnboardingController = new DistributorOnboardingController(onboardingUseCases);
    this.enterpriseDmsController = new EnterpriseDmsController();

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
      await this.recordAuditLog('unknown', 'unknown', 'auth.access_denied', 'Missing credentials', request);
      return { status: 401, headers: responseHeaders, body: { error: 'Authentication required', code: 'AUTH_REQUIRED' } };
    }

    let tenantId = request.headers['x-tenant-id'] ?? 'unknown';
    let principal: { id: string; tenantId: string; roles: string[] } | undefined;

    if (authHeader.startsWith('Bearer ')) {
      const authResult = await this.jwtAuth.verify({ headers: { authorization: authHeader } });
      if (!authResult.authenticated || !authResult.payload) {
        await this.recordAuditLog('unknown', tenantId, 'auth.access_denied', authResult.error ?? 'Invalid token', request);
        return { status: 401, headers: responseHeaders, body: { error: authResult.error ?? 'Invalid token', code: 'INVALID_TOKEN' } };
      }
      tenantId = authResult.payload.tenantId;
      principal = {
        id: authResult.payload.sub,
        tenantId: authResult.payload.tenantId,
        roles: authResult.payload.roles,
      };
    } else {
      await this.recordAuditLog('unknown', tenantId, 'auth.access_denied', 'Unsupported auth scheme', request);
      return { status: 401, headers: responseHeaders, body: { error: 'Invalid token scheme', code: 'INVALID_TOKEN' } };
    }

    // RBAC check (deny-by-default)
    if (handler.requiredPermissions && handler.requiredPermissions.length > 0) {
      if (!principal) {
        await this.recordAuditLog('unknown', tenantId, 'auth.access_denied', 'Principal missing for RBAC', request);
        return { status: 403, headers: responseHeaders, body: { error: 'Forbidden', code: 'FORBIDDEN' } };
      }

      // Deny by default: principal must satisfy ALL required permissions
      const hasPermission = handler.requiredPermissions.every((perm) =>
        RbacGuard.can(principal!, perm)
      );

      if (!hasPermission) {
        await this.recordAuditLog(principal.id, tenantId, 'auth.access_denied', `Insufficient permissions: missing ${handler.requiredPermissions.join(', ')}`, request);
        return { status: 403, headers: responseHeaders, body: { error: 'Forbidden', code: 'FORBIDDEN' } };
      }

      // Record privilege use
      await this.recordAuditLog(principal.id, tenantId, 'auth.privilege_use', `Granted access. Permission: ${handler.requiredPermissions.join(', ')}`, request);
    }

    // Rate limiting
    const rateLimitKey = `${tenantId}:${handler.targetService}:${handler.targetPath}`;
    if (!this.rateLimitStore.tryAcquire(rateLimitKey, handler.rateLimit)) {
      const remaining = this.rateLimitStore.remaining(rateLimitKey, handler.rateLimit);
      responseHeaders['x-ratelimit-remaining'] = String(remaining);
      return { status: 429, headers: responseHeaders, body: { error: 'Rate limit exceeded', code: 'RATE_LIMIT_EXCEEDED' } };
    }

    responseHeaders['x-ratelimit-remaining'] = String(this.rateLimitStore.remaining(rateLimitKey, handler.rateLimit));

    // Forward to upstream
    if (handler.targetService === 'sfa-service' && handler.targetPath === '/orders') {
      let resultBody: any;
      let statusCode = 200;

      if (request.method === 'POST') {
        const res = await this.sfaOrderController.handlePostOrder(request.body, {
          'x-tenant-id': tenantId,
          'x-agent-id': principal?.id || 'unknown',
        });
        statusCode = res.statusCode;
        resultBody = res.body;
      } else if (request.method === 'DELETE') {
        const orderId = params.id || (request.body as any)?.orderId;
        const res = await this.sfaOrderController.handleCancelOrder(orderId, {
          'x-tenant-id': tenantId,
        });
        statusCode = res.statusCode;
        resultBody = res.body;
      } else {
        const upstreamResponse = this.forwardToUpstream(handler, request, params);
        return { status: 200, headers: { ...responseHeaders, 'x-upstream-service': handler.targetService }, body: upstreamResponse };
      }

      return { status: statusCode, headers: { ...responseHeaders, 'x-upstream-service': 'sfa-service' }, body: resultBody };
    }

    if (handler.targetService === 'schemes-service' && handler.targetPath === '/schemes') {
      let resultBody: any;
      let statusCode = 200;

      if (request.method === 'POST') {
        const res = await this.schemesController.handlePostScheme(request.body, {
          'x-tenant-id': tenantId,
        });
        statusCode = res.statusCode;
        resultBody = res.body;
      } else if (request.method === 'GET') {
        const id = params.id || (request.body as any)?.schemeId;
        if (id) {
          const res = await this.schemesController.handleGetScheme(id, {
            'x-tenant-id': tenantId,
          });
          statusCode = res.statusCode;
          resultBody = res.body;
        } else {
          const res = await this.schemesController.handleListSchemes(request.body || {}, {
            'x-tenant-id': tenantId,
          });
          statusCode = res.statusCode;
          resultBody = res.body;
        }
      } else if (request.method === 'PUT') {
        const id = params.id || (request.body as any)?.schemeId;
        const res = await this.schemesController.handlePutScheme(id, request.body, {
          'x-tenant-id': tenantId,
        });
        statusCode = res.statusCode;
        resultBody = res.body;
      } else {
        const upstreamResponse = this.forwardToUpstream(handler, request, params);
        return { status: 200, headers: { ...responseHeaders, 'x-upstream-service': handler.targetService }, body: upstreamResponse };
      }

      return { status: statusCode, headers: { ...responseHeaders, 'x-upstream-service': 'schemes-service' }, body: resultBody };
    }

    if (handler.targetService === 'dms-core-service' && handler.targetPath.startsWith('/distributors')) {
      let resultBody: any = {};
      let statusCode = 200;

      const subPath = request.path.replace('/api/v1/distributors', '');

      if (subPath === '/onboarding' && request.method === 'POST') {
        const res = await this.distributorOnboardingController.handleCreateOnboarding(request.body as any, { 'x-tenant-id': tenantId });
        statusCode = res.status;
        resultBody = res.body;
      } else if (subPath === '/onboarding/submit-kyc' && request.method === 'POST') {
        const res = await this.distributorOnboardingController.handleSubmitForKYC(request.body as any, { 'x-tenant-id': tenantId });
        statusCode = res.status;
        resultBody = res.body;
      } else if (subPath === '/onboarding/approve-kyc' && request.method === 'POST') {
        const res = await this.distributorOnboardingController.handleApproveKYC(request.body as any, { 'x-tenant-id': tenantId });
        statusCode = res.status;
        resultBody = res.body;
      } else if (subPath === '/onboarding/approve-credit' && request.method === 'POST') {
        const res = await this.distributorOnboardingController.handleApproveCreditCheck(request.body as any, { 'x-tenant-id': tenantId });
        statusCode = res.status;
        resultBody = res.body;
      } else if (subPath === '/onboarding/sign-contract' && request.method === 'POST') {
        const res = await this.distributorOnboardingController.handleSignContract(request.body as any, { 'x-tenant-id': tenantId });
        statusCode = res.status;
        resultBody = res.body;
      } else if (subPath === '/onboarding/activate' && request.method === 'POST') {
        const res = await this.distributorOnboardingController.handleActivate(request.body as any, { 'x-tenant-id': tenantId });
        statusCode = res.status;
        resultBody = res.body;
      } else if (subPath === '/hierarchy' && request.method === 'POST') {
        const res = await this.enterpriseDmsController.handleCreateHierarchy(request.body as any, { 'x-tenant-id': tenantId });
        statusCode = res.status;
        resultBody = res.body;
      } else if (subPath === '/kyc' && request.method === 'POST') {
        const res = await this.enterpriseDmsController.handleUploadKYCDocument(request.body as any, { 'x-tenant-id': tenantId });
        statusCode = res.status;
        resultBody = res.body;
      } else if (subPath === '/kyc/verify' && request.method === 'POST') {
        const res = await this.enterpriseDmsController.handleVerifyKYCDocument(request.body as any, { 'x-tenant-id': tenantId });
        statusCode = res.status;
        resultBody = res.body;
      } else if (subPath === '/credit-limit' && request.method === 'POST') {
        const res = await this.enterpriseDmsController.handleCreateCreditLimit(request.body as any, { 'x-tenant-id': tenantId });
        statusCode = res.status;
        resultBody = res.body;
      } else if (subPath === '/credit-limit/utilize' && request.method === 'POST') {
        const res = await this.enterpriseDmsController.handleUtilizeCredit(request.body as any, { 'x-tenant-id': tenantId });
        statusCode = res.status;
        resultBody = res.body;
      } else {
        const upstreamResponse = this.forwardToUpstream(handler, request, params);
        return { status: 200, headers: { ...responseHeaders, 'x-upstream-service': handler.targetService }, body: upstreamResponse };
      }

      return { status: statusCode, headers: { ...responseHeaders, 'x-upstream-service': 'dms-core-service' }, body: resultBody };
    }

    if (handler.targetService === 'dms-core-service' && handler.targetPath.startsWith('/inventory')) {
      let resultBody: any = {};
      let statusCode = 200;

      const subPath = request.path.replace('/api/v1/inventory', '');

      if (subPath === '/allocate' && request.method === 'POST') {
        const res = await this.enterpriseDmsController.handleAllocateStockFEFO(request.body as any, { 'x-tenant-id': tenantId });
        statusCode = res.status;
        resultBody = res.body;
      } else if (subPath === '/alerts' && (request.method === 'GET' || request.method === 'POST')) {
        const res = await this.enterpriseDmsController.handleGetNearExpiryAlerts((request.body || {}) as any, { 'x-tenant-id': tenantId });
        statusCode = res.status;
        resultBody = res.body;
      } else if (subPath === '/reconcile' && request.method === 'POST') {
        const res = await this.enterpriseDmsController.handleReconcileStock(request.body as any, { 'x-tenant-id': tenantId });
        statusCode = res.status;
        resultBody = res.body;
      } else if (request.method === 'POST') {
        const res = await this.enterpriseDmsController.handleAdjustStock(request.body as any, { 'x-tenant-id': tenantId });
        statusCode = res.status;
        resultBody = res.body;
      } else {
        const upstreamResponse = this.forwardToUpstream(handler, request, params);
        return { status: 200, headers: { ...responseHeaders, 'x-upstream-service': handler.targetService }, body: upstreamResponse };
      }

      return { status: statusCode, headers: { ...responseHeaders, 'x-upstream-service': 'dms-core-service' }, body: resultBody };
    }

    const upstreamResponse = this.forwardToUpstream(handler, request, params);
    return { status: 200, headers: { ...responseHeaders, 'x-upstream-service': handler.targetService }, body: upstreamResponse };
  }

  private async recordAuditLog(
    actor: string,
    tenantId: string,
    type: string,
    result: string,
    request: GatewayRequest
  ): Promise<void> {
    try {
      const auditController = AuditController.getInstance();
      await auditController.handlePostRecordEvent(
        {
          eventId: `evt-${randomUUID()}`,
          type,
          actor,
          tenantId,
          result,
          metadata: {
            path: request.path,
            method: request.method,
            timestamp: new Date().toISOString(),
            correlationId: request.headers['x-request-id'] || randomUUID(),
          },
        },
        { 'x-tenant-id': tenantId }
      );
    } catch {
      // Tolerate logging errors
    }
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
