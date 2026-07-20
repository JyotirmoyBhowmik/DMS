import { randomUUID } from 'node:crypto';
import { TrieRouter, ApiKeyValidator, RateLimitStore, InMemoryRouteRepository } from '../../../infrastructure/routing/trie_router.js';
import type { RouteHandler } from '../../../infrastructure/routing/trie_router.js';
import { JwtAuthMiddleware } from '../../../middleware/auth.js';
import { RbacGuard } from '@dms/pkg-rbac';
import { AuditController } from '../../../../../audit-service/src/presentation/rest/controllers/audit.controller.js';
import { KeyManager } from '../../../../../identity-service/src/application/usecases/key_manager.js';
import { loadConfigSync } from '@dms/pkg-config';
import { OrderController } from '../../../../../sfa-service/src/presentation/rest/controllers/order.controller.js';
import { OrderApprovalController } from '../../../../../sfa-service/src/presentation/rest/controllers/order_approval.controller.js';
import { JourneyPlanController } from '../../../../../sfa-service/src/presentation/rest/controllers/journey_plan.controller.js';
import { BeatRouteController } from '../../../../../sfa-service/src/presentation/rest/controllers/beat_route.controller.js';
import { VisitController as SfaVisitController } from '../../../../../sfa-service/src/presentation/rest/controllers/visit.controller.js';
import { AttendanceController as SfaAttendanceController } from '../../../../../sfa-service/src/presentation/rest/controllers/attendance.controller.js';
import { GeoCheckInController as SfaGeoCheckInController } from '../../../../../sfa-service/src/presentation/rest/controllers/geo_checkin.controller.js';
import { OutletCensusController as SfaOutletCensusController } from '../../../../../sfa-service/src/presentation/rest/controllers/outlet_census.controller.js';
import { OutletProfileController as SfaOutletProfileController } from '../../../../../sfa-service/src/presentation/rest/controllers/outlet-profile.controller.js';
import { VanSaleController as SfaVanSaleController } from '../../../../../sfa-service/src/presentation/rest/controllers/van-sale.controller.js';
import { DeliveryConfirmationController as SfaDeliveryConfirmationController } from '../../../../../sfa-service/src/presentation/rest/controllers/delivery-confirmation.controller.js';
import { MerchandisingAuditController as SfaMerchandisingAuditController } from '../../../../../sfa-service/src/presentation/rest/controllers/merchandising-audit.controller.js';
import { CompetitorCaptureController as SfaCompetitorCaptureController } from '../../../../../sfa-service/src/presentation/rest/controllers/competitor-capture.controller.js';
import { PhotoCaptureController as SfaPhotoCaptureController } from '../../../../../sfa-service/src/presentation/rest/controllers/photo-capture.controller.js';
import { SalesTargetController as SfaSalesTargetController } from '../../../../../sfa-service/src/presentation/rest/controllers/sales-target.controller.js';
import { KPIAchievementController as SfaKPIAchievementController } from '../../../../../sfa-service/src/presentation/rest/controllers/kpi-achievement.controller.js';
import { FieldRepController as SfaFieldRepController } from '../../../../../sfa-service/src/presentation/rest/controllers/field-rep.controller.js';
import { SurveyController as SfaSurveyController } from '../../../../../sfa-service/src/presentation/rest/controllers/survey.controller.js';
import { SchemeController } from '../../../../../schemes-service/src/presentation/rest/controllers/scheme.controller.js';
import { ClaimController } from '../../../../../claims-service/src/presentation/rest/controllers/claim.controller.js';
import { EnterpriseDmsController } from '../../../../../dms-core-service/src/presentation/rest/controllers/enterprise_dms.controller.js';
import { DistributorOnboardingController } from '../../../../../dms-core-service/src/presentation/rest/controllers/distributor-onboarding.controller.js';
import { DistributorOnboardingUseCases } from '../../../../../dms-core-service/src/application/usecases/distributor-onboarding/distributor-onboarding.usecases.js';
import { DistributorOnboardingPgRepository } from '../../../../../dms-core-service/src/infrastructure/database/repositories/distributor-onboarding.pg-repository.js';
import { PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';

import { AuthController as IdentityAuthController } from '../../../../../identity-service/src/presentation/rest/controllers/auth.controller.js';
import { UserController as IdentityUserController } from '../../../../../identity-service/src/presentation/rest/controllers/user.controller.js';
import { RoleController as IdentityRoleController } from '../../../../../identity-service/src/presentation/rest/controllers/role.controller.js';
import { TenantController as IdentityTenantController } from '../../../../../identity-service/src/presentation/rest/controllers/tenant.controller.js';
import { PermissionController as IdentityPermissionController } from '../../../../../identity-service/src/presentation/rest/controllers/permission.controller.js';
import { MFADeviceController as IdentityMfaController } from '../../../../../identity-service/src/presentation/rest/controllers/mfa_device.controller.js';


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
  private readonly sfaOrderApprovalController: OrderApprovalController;
  private readonly sfaJourneyPlanController: JourneyPlanController;
  private readonly sfaBeatRouteController: BeatRouteController;
  private readonly sfaVisitController: SfaVisitController;
  private readonly sfaAttendanceController: SfaAttendanceController;
  private readonly sfaGeoCheckInController: SfaGeoCheckInController;
  private readonly sfaOutletCensusController: SfaOutletCensusController;
  private readonly sfaOutletProfileController: SfaOutletProfileController;
  private readonly sfaVanSaleController: SfaVanSaleController;
  private readonly sfaDeliveryConfirmationController: SfaDeliveryConfirmationController;
  private readonly sfaMerchandisingAuditController: SfaMerchandisingAuditController;
  private readonly sfaCompetitorCaptureController: SfaCompetitorCaptureController;
  private readonly sfaPhotoCaptureController: SfaPhotoCaptureController;
  private readonly sfaSalesTargetController: SfaSalesTargetController;
  private readonly sfaKPIAchievementController: SfaKPIAchievementController;
  private readonly sfaFieldRepController: SfaFieldRepController;
  private readonly sfaSurveyController: SfaSurveyController;
  private readonly schemesController: SchemeController;
  private readonly claimsController: ClaimController;
  private readonly enterpriseDmsController: EnterpriseDmsController;
  private readonly distributorOnboardingController: DistributorOnboardingController;
  private readonly identityAuthController: IdentityAuthController;
  private readonly identityUserController: IdentityUserController;
  private readonly identityRoleController: IdentityRoleController;
  private readonly identityTenantController: IdentityTenantController;
  private readonly identityPermissionController: IdentityPermissionController;
  private readonly identityMfaController: IdentityMfaController;

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
    this.sfaOrderApprovalController = new OrderApprovalController();
    this.sfaJourneyPlanController = new JourneyPlanController();
    this.sfaBeatRouteController = new BeatRouteController();
    this.sfaVisitController = new SfaVisitController();
    this.sfaAttendanceController = new SfaAttendanceController();
    this.sfaGeoCheckInController = new SfaGeoCheckInController();
    this.sfaOutletCensusController = new SfaOutletCensusController();
    this.sfaOutletProfileController = new SfaOutletProfileController();
    this.sfaVanSaleController = new SfaVanSaleController();
    this.sfaDeliveryConfirmationController = new SfaDeliveryConfirmationController();
    this.sfaMerchandisingAuditController = new SfaMerchandisingAuditController();
    this.sfaCompetitorCaptureController = new SfaCompetitorCaptureController();
    this.sfaPhotoCaptureController = new SfaPhotoCaptureController();
    this.sfaSalesTargetController = new SfaSalesTargetController();
    this.sfaKPIAchievementController = new SfaKPIAchievementController();
    this.sfaFieldRepController = new SfaFieldRepController();
    this.sfaSurveyController = new SfaSurveyController();
    this.schemesController = new SchemeController();
    this.claimsController = new ClaimController();
    this.identityAuthController = new IdentityAuthController();
    this.identityUserController = new IdentityUserController();
    this.identityRoleController = new IdentityRoleController();
    this.identityTenantController = new IdentityTenantController();
    this.identityPermissionController = new IdentityPermissionController();
    this.identityMfaController = new IdentityMfaController();

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

    // Body size validation (413 Payload Too Large)
    if (request.body) {
      const bodyStr = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
      if (bodyStr.length > 2 * 1024 * 1024) { // 2MB limit
        return {
          status: 413,
          headers: responseHeaders,
          body: { error: 'Payload Too Large', code: 'PAYLOAD_TOO_LARGE' }
        };
      }
    }

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
    if (handler.targetService === 'sfa-service' && handler.targetPath === '/attendance') {
      let resultBody: any;
      let statusCode = 200;

      if (request.method === 'POST') {
        const res = await this.sfaAttendanceController.handlePostAttendance(request.body, {
          'x-tenant-id': tenantId,
        });
        statusCode = res.statusCode;
        resultBody = res.body;
      } else if (request.method === 'PUT') {
        const res = await this.sfaAttendanceController.handlePutAttendance(params.id || '', request.body, {
          'x-tenant-id': tenantId,
        });
        statusCode = res.statusCode;
        resultBody = res.body;
      } else if (request.method === 'GET') {
        const id = params.id;
        if (id) {
          const res = await this.sfaAttendanceController.handleGetAttendance(id, {
            'x-tenant-id': tenantId,
          });
          statusCode = res.statusCode;
          resultBody = res.body;
        } else {
          const res = await this.sfaAttendanceController.handleListAttendances(request.body || {}, {
            'x-tenant-id': tenantId,
          });
          statusCode = res.statusCode;
          resultBody = res.body;
        }
      } else {
        const upstreamResponse = this.forwardToUpstream(handler, request, params);
        return { status: 200, headers: { ...responseHeaders, 'x-upstream-service': handler.targetService }, body: upstreamResponse };
      }

      return { status: statusCode, headers: { ...responseHeaders, 'x-upstream-service': 'sfa-service' }, body: resultBody };
    }

    if (handler.targetService === 'sfa-service' && handler.targetPath === '/geo-check-in') {
      let resultBody: any;
      let statusCode = 200;

      if (request.method === 'POST') {
        const res = await this.sfaGeoCheckInController.handlePostGeoCheckIn(request.body, {
          'x-tenant-id': tenantId,
        });
        statusCode = res.statusCode;
        resultBody = res.body;
      } else if (request.method === 'PUT') {
        const res = await this.sfaGeoCheckInController.handlePutGeoCheckIn(params.id || '', request.body, {
          'x-tenant-id': tenantId,
        });
        statusCode = res.statusCode;
        resultBody = res.body;
      } else if (request.method === 'GET') {
        const id = params.id;
        if (id) {
          const res = await this.sfaGeoCheckInController.handleGetGeoCheckIn(id, {
            'x-tenant-id': tenantId,
          });
          statusCode = res.statusCode;
          resultBody = res.body;
        } else {
          const res = await this.sfaGeoCheckInController.handleListGeoCheckIns(request.body || {}, {
            'x-tenant-id': tenantId,
          });
          statusCode = res.statusCode;
          resultBody = res.body;
        }
      } else {
        const upstreamResponse = this.forwardToUpstream(handler, request, params);
        return { status: 200, headers: { ...responseHeaders, 'x-upstream-service': handler.targetService }, body: upstreamResponse };
      }

      return { status: statusCode, headers: { ...responseHeaders, 'x-upstream-service': 'sfa-service' }, body: resultBody };
    }

    if (handler.targetService === 'sfa-service' && handler.targetPath === '/outlet-census') {
      let resultBody: any;
      let statusCode = 200;

      if (request.method === 'POST') {
        const res = await this.sfaOutletCensusController.handlePostOutletCensus(request.body, {
          'x-tenant-id': tenantId,
        });
        statusCode = res.statusCode;
        resultBody = res.body;
      } else if (request.method === 'PUT') {
        const res = await this.sfaOutletCensusController.handlePutOutletCensus(params.id || '', request.body, {
          'x-tenant-id': tenantId,
        });
        statusCode = res.statusCode;
        resultBody = res.body;
      } else if (request.method === 'GET') {
        const id = params.id;
        if (id) {
          const res = await this.sfaOutletCensusController.handleGetOutletCensus(id, {
            'x-tenant-id': tenantId,
          });
          statusCode = res.statusCode;
          resultBody = res.body;
        } else {
          const res = await this.sfaOutletCensusController.handleListOutletCensuses(request.body || {}, {
            'x-tenant-id': tenantId,
          });
          statusCode = res.statusCode;
          resultBody = res.body;
        }
      } else {
        const upstreamResponse = this.forwardToUpstream(handler, request, params);
        return { status: 200, headers: { ...responseHeaders, 'x-upstream-service': handler.targetService }, body: upstreamResponse };
      }

      return { status: statusCode, headers: { ...responseHeaders, 'x-upstream-service': 'sfa-service' }, body: resultBody };
    }

    if (handler.targetService === 'sfa-service' && handler.targetPath === '/outlet-profile') {
      let resultBody: any;
      let statusCode = 200;

      if (request.method === 'POST') {
        const res = await this.sfaOutletProfileController.handlePostOutletProfile(request.body, {
          'x-tenant-id': tenantId,
        });
        statusCode = res.statusCode;
        resultBody = res.body;
      } else if (request.method === 'PUT') {
        const res = await this.sfaOutletProfileController.handlePutOutletProfile(params.id || '', request.body, {
          'x-tenant-id': tenantId,
        });
        statusCode = res.statusCode;
        resultBody = res.body;
      } else if (request.method === 'GET') {
        const id = params.id;
        if (id) {
          const res = await this.sfaOutletProfileController.handleGetOutletProfile(id, {
            'x-tenant-id': tenantId,
          });
          statusCode = res.statusCode;
          resultBody = res.body;
        } else {
          const res = await this.sfaOutletProfileController.handleListOutletProfiles(request.body || {}, {
            'x-tenant-id': tenantId,
          });
          statusCode = res.statusCode;
          resultBody = res.body;
        }
      } else if (request.method === 'DELETE') {
        const res = await this.sfaOutletProfileController.handleDeleteOutletProfile(params.id || '', {
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

    if (handler.targetService === 'sfa-service' && handler.targetPath === '/van-sales') {
      let resultBody: any;
      let statusCode = 200;

      const enrichedHeaders = {
        'x-tenant-id': tenantId,
        'x-user-id': principal?.id || '',
        'x-user-roles': principal?.roles?.join(',') || '',
      };

      if (request.method === 'POST') {
        const res = await this.sfaVanSaleController.handlePostVanSale(request.body, enrichedHeaders);
        statusCode = res.statusCode;
        resultBody = res.body;
      } else if (request.method === 'PUT') {
        const res = await this.sfaVanSaleController.handlePutVanSale(params.id || '', request.body, enrichedHeaders);
        statusCode = res.statusCode;
        resultBody = res.body;
      } else if (request.method === 'GET') {
        const id = params.id;
        if (id) {
          const res = await this.sfaVanSaleController.handleGetVanSale(id, enrichedHeaders);
          statusCode = res.statusCode;
          resultBody = res.body;
        } else {
          const res = await this.sfaVanSaleController.handleListVanSales(request.body || {}, enrichedHeaders);
          statusCode = res.statusCode;
          resultBody = res.body;
        }
      } else if (request.method === 'DELETE') {
        const res = await this.sfaVanSaleController.handleDeleteVanSale(params.id || '', enrichedHeaders);
        statusCode = res.statusCode;
        resultBody = res.body;
      } else {
        const upstreamResponse = this.forwardToUpstream(handler, request, params);
        return { status: 200, headers: { ...responseHeaders, 'x-upstream-service': handler.targetService }, body: upstreamResponse };
      }

      return { status: statusCode, headers: { ...responseHeaders, 'x-upstream-service': 'sfa-service' }, body: resultBody };
    }

    if (handler.targetService === 'sfa-service' && handler.targetPath === '/delivery-confirmations') {
      let resultBody: any;
      let statusCode = 200;

      const enrichedHeaders = {
        'x-tenant-id': tenantId,
        'x-user-id': principal?.id || '',
        'x-user-roles': principal?.roles?.join(',') || '',
      };

      if (request.method === 'POST') {
        const res = await this.sfaDeliveryConfirmationController.handleCreate(request.body, enrichedHeaders);
        statusCode = res.statusCode;
        resultBody = res.body;
      } else if (request.method === 'PUT') {
        const res = await this.sfaDeliveryConfirmationController.handlePutDeliveryConfirmation(params.id || '', request.body, enrichedHeaders);
        statusCode = res.statusCode;
        resultBody = res.body;
      } else if (request.method === 'GET') {
        const id = params.id;
        if (id) {
          const res = await this.sfaDeliveryConfirmationController.handleGetDeliveryConfirmation(id, enrichedHeaders);
          statusCode = res.statusCode;
          resultBody = res.body;
        } else {
          const res = await this.sfaDeliveryConfirmationController.handleListDeliveryConfirmations(request.body || {}, enrichedHeaders);
          statusCode = res.statusCode;
          resultBody = res.body;
        }
      } else if (request.method === 'DELETE') {
        const res = await this.sfaDeliveryConfirmationController.handleDeleteDeliveryConfirmation(params.id || '', enrichedHeaders);
        statusCode = res.statusCode;
        resultBody = res.body;
      } else {
        const upstreamResponse = this.forwardToUpstream(handler, request, params);
        return { status: 200, headers: { ...responseHeaders, 'x-upstream-service': handler.targetService }, body: upstreamResponse };
      }

      return { status: statusCode, headers: { ...responseHeaders, 'x-upstream-service': 'sfa-service' }, body: resultBody };
    }

    if (handler.targetService === 'sfa-service' && handler.targetPath === '/merchandising-audits') {
      let resultBody: any;
      let statusCode = 200;

      const enrichedHeaders = {
        'x-tenant-id': tenantId,
        'x-user-id': principal?.id || '',
        'x-user-roles': principal?.roles?.join(',') || '',
      };

      if (request.method === 'POST') {
        const res = await this.sfaMerchandisingAuditController.handleCreate(request.body, enrichedHeaders);
        statusCode = res.statusCode;
        resultBody = res.body;
      } else if (request.method === 'PUT') {
        const res = await this.sfaMerchandisingAuditController.handlePut(params.id || '', request.body, enrichedHeaders);
        statusCode = res.statusCode;
        resultBody = res.body;
      } else if (request.method === 'GET') {
        const id = params.id;
        if (id) {
          const res = await this.sfaMerchandisingAuditController.handleGet(id, enrichedHeaders);
          statusCode = res.statusCode;
          resultBody = res.body;
        } else {
          const res = await this.sfaMerchandisingAuditController.handleList(request.body || {}, enrichedHeaders);
          statusCode = res.statusCode;
          resultBody = res.body;
        }
      } else if (request.method === 'DELETE') {
        const res = await this.sfaMerchandisingAuditController.handleDelete(params.id || '', enrichedHeaders);
        statusCode = res.statusCode;
        resultBody = res.body;
      } else {
        const upstreamResponse = this.forwardToUpstream(handler, request, params);
        return { status: 200, headers: { ...responseHeaders, 'x-upstream-service': handler.targetService }, body: upstreamResponse };
      }

      return { status: statusCode, headers: { ...responseHeaders, 'x-upstream-service': 'sfa-service' }, body: resultBody };
    }

    if (handler.targetService === 'sfa-service' && handler.targetPath === '/competitor-captures') {
      let resultBody: any;
      let statusCode = 200;

      const enrichedHeaders = {
        'x-tenant-id': tenantId,
        'x-user-id': principal?.id || '',
        'x-user-roles': principal?.roles?.join(',') || '',
      };

      if (request.method === 'POST') {
        const res = await this.sfaCompetitorCaptureController.handleCreate(request.body, enrichedHeaders);
        statusCode = res.statusCode;
        resultBody = res.body;
      } else if (request.method === 'PUT') {
        const res = await this.sfaCompetitorCaptureController.handlePut(params.id || '', request.body, enrichedHeaders);
        statusCode = res.statusCode;
        resultBody = res.body;
      } else if (request.method === 'GET') {
        const id = params.id;
        if (id) {
          const res = await this.sfaCompetitorCaptureController.handleGet(id, enrichedHeaders);
          statusCode = res.statusCode;
          resultBody = res.body;
        } else {
          const res = await this.sfaCompetitorCaptureController.handleList(request.body || {}, enrichedHeaders);
          statusCode = res.statusCode;
          resultBody = res.body;
        }
      } else if (request.method === 'DELETE') {
        const res = await this.sfaCompetitorCaptureController.handleDelete(params.id || '', enrichedHeaders);
        statusCode = res.statusCode;
        resultBody = res.body;
      } else {
        const upstreamResponse = this.forwardToUpstream(handler, request, params);
        return { status: 200, headers: { ...responseHeaders, 'x-upstream-service': handler.targetService }, body: upstreamResponse };
      }

      return { status: statusCode, headers: { ...responseHeaders, 'x-upstream-service': 'sfa-service' }, body: resultBody };
    }

    if (handler.targetService === 'sfa-service' && handler.targetPath === '/photo-captures') {
      let resultBody: any;
      let statusCode = 200;

      const enrichedHeaders = {
        'x-tenant-id': tenantId,
        'x-user-id': principal?.id || '',
        'x-user-roles': principal?.roles?.join(',') || '',
      };

      if (request.method === 'POST') {
        const res = await this.sfaPhotoCaptureController.handleCreate(request.body, enrichedHeaders);
        statusCode = res.statusCode;
        resultBody = res.body;
      } else if (request.method === 'PUT') {
        const res = await this.sfaPhotoCaptureController.handleUpdate(params.id || '', request.body, enrichedHeaders);
        statusCode = res.statusCode;
        resultBody = res.body;
      } else if (request.method === 'GET') {
        const id = params.id;
        if (id) {
          const res = await this.sfaPhotoCaptureController.handleGet(id, enrichedHeaders);
          statusCode = res.statusCode;
          resultBody = res.body;
        } else {
          const res = await this.sfaPhotoCaptureController.handleList(request.body || {}, enrichedHeaders);
          statusCode = res.statusCode;
          resultBody = res.body;
        }
      } else if (request.method === 'DELETE') {
        const res = await this.sfaPhotoCaptureController.handleDelete(params.id || '', enrichedHeaders);
        statusCode = res.statusCode;
        resultBody = res.body;
      } else {
        const upstreamResponse = this.forwardToUpstream(handler, request, params);
        return { status: 200, headers: { ...responseHeaders, 'x-upstream-service': handler.targetService }, body: upstreamResponse };
      }

      return { status: statusCode, headers: { ...responseHeaders, 'x-upstream-service': 'sfa-service' }, body: resultBody };
    }

    if (handler.targetService === 'sfa-service' && handler.targetPath === '/sales-targets') {
      let resultBody: any;
      let statusCode = 200;

      const enrichedHeaders = {
        'x-tenant-id': tenantId,
        'x-user-id': principal?.id || '',
        'x-user-roles': principal?.roles?.join(',') || '',
      };

      if (request.method === 'POST') {
        const res = await this.sfaSalesTargetController.handleCreate(request.body, enrichedHeaders);
        statusCode = res.statusCode;
        resultBody = res.body;
      } else if (request.method === 'PUT') {
        const res = await this.sfaSalesTargetController.handleUpdate(params.id || '', request.body, enrichedHeaders);
        statusCode = res.statusCode;
        resultBody = res.body;
      } else if (request.method === 'GET') {
        const id = params.id;
        if (id) {
          const res = await this.sfaSalesTargetController.handleGet(id, enrichedHeaders);
          statusCode = res.statusCode;
          resultBody = res.body;
        } else {
          const res = await this.sfaSalesTargetController.handleList(request.body || {}, enrichedHeaders);
          statusCode = res.statusCode;
          resultBody = res.body;
        }
      } else {
        const upstreamResponse = this.forwardToUpstream(handler, request, params);
        return { status: 200, headers: { ...responseHeaders, 'x-upstream-service': handler.targetService }, body: upstreamResponse };
      }

      return { status: statusCode, headers: { ...responseHeaders, 'x-upstream-service': 'sfa-service' }, body: resultBody };
    }

    if (handler.targetService === 'sfa-service' && handler.targetPath === '/kpi-achievements') {
      let resultBody: any;
      let statusCode = 200;

      const enrichedHeaders = {
        'x-tenant-id': tenantId,
        'x-user-id': principal?.id || '',
        'x-user-roles': principal?.roles?.join(',') || '',
      };

      if (request.method === 'POST') {
        const res = await this.sfaKPIAchievementController.handleCreate(request.body, enrichedHeaders);
        statusCode = res.statusCode;
        resultBody = res.body;
      } else if (request.method === 'PUT') {
        const res = await this.sfaKPIAchievementController.handleUpdate(params.id || '', request.body, enrichedHeaders);
        statusCode = res.statusCode;
        resultBody = res.body;
      } else if (request.method === 'GET') {
        const id = params.id;
        if (id) {
          const res = await this.sfaKPIAchievementController.handleGet(id, enrichedHeaders);
          statusCode = res.statusCode;
          resultBody = res.body;
        } else {
          const res = await this.sfaKPIAchievementController.handleList(request.body || {}, enrichedHeaders);
          statusCode = res.statusCode;
          resultBody = res.body;
        }
      } else {
        const upstreamResponse = this.forwardToUpstream(handler, request, params);
        return { status: 200, headers: { ...responseHeaders, 'x-upstream-service': handler.targetService }, body: upstreamResponse };
      }

      return { status: statusCode, headers: { ...responseHeaders, 'x-upstream-service': 'sfa-service' }, body: resultBody };
    }

    if (handler.targetService === 'sfa-service' && handler.targetPath === '/field-reps') {
      let resultBody: any;
      let statusCode = 200;

      const enrichedHeaders = {
        'x-tenant-id': tenantId,
        'x-user-id': principal?.id || '',
        'x-user-roles': principal?.roles?.join(',') || '',
      };

      if (request.method === 'POST') {
        const res = await this.sfaFieldRepController.handleCreate(request.body, enrichedHeaders);
        statusCode = res.statusCode;
        resultBody = res.body;
      } else if (request.method === 'PUT') {
        const res = await this.sfaFieldRepController.handleUpdate(params.id || '', request.body, enrichedHeaders);
        statusCode = res.statusCode;
        resultBody = res.body;
      } else if (request.method === 'GET') {
        const id = params.id;
        if (id) {
          const res = await this.sfaFieldRepController.handleGet(id, enrichedHeaders);
          statusCode = res.statusCode;
          resultBody = res.body;
        } else {
          const res = await this.sfaFieldRepController.handleList(request.body || {}, enrichedHeaders);
          statusCode = res.statusCode;
          resultBody = res.body;
        }
      } else {
        const upstreamResponse = this.forwardToUpstream(handler, request, params);
        return { status: 200, headers: { ...responseHeaders, 'x-upstream-service': handler.targetService }, body: upstreamResponse };
      }

      return { status: statusCode, headers: { ...responseHeaders, 'x-upstream-service': 'sfa-service' }, body: resultBody };
    }

    if (handler.targetService === 'sfa-service' && handler.targetPath === '/surveys') {
      let resultBody: any;
      let statusCode = 200;

      const enrichedHeaders = {
        'x-tenant-id': tenantId,
        'x-user-id': principal?.id || '',
        'x-user-roles': principal?.roles?.join(',') || '',
      };

      if (request.method === 'POST') {
        const res = await this.sfaSurveyController.handleCreate(request.body, enrichedHeaders);
        statusCode = res.statusCode;
        resultBody = res.body;
      } else if (request.method === 'PUT') {
        const res = await this.sfaSurveyController.handleUpdate(params.id || '', request.body, enrichedHeaders);
        statusCode = res.statusCode;
        resultBody = res.body;
      } else if (request.method === 'GET') {
        const id = params.id;
        if (id) {
          const res = await this.sfaSurveyController.handleGet(id, enrichedHeaders);
          statusCode = res.statusCode;
          resultBody = res.body;
        } else {
          const res = await this.sfaSurveyController.handleList(request.body || {}, enrichedHeaders);
          statusCode = res.statusCode;
          resultBody = res.body;
        }
      } else {
        const upstreamResponse = this.forwardToUpstream(handler, request, params);
        return { status: 200, headers: { ...responseHeaders, 'x-upstream-service': handler.targetService }, body: upstreamResponse };
      }

      return { status: statusCode, headers: { ...responseHeaders, 'x-upstream-service': 'sfa-service' }, body: resultBody };
    }

    if (handler.targetService === 'sfa-service' && handler.targetPath === '/visits') {
      let resultBody: any;
      let statusCode = 200;

      if (request.method === 'POST') {
        const res = await this.sfaVisitController.handlePostVisit(request.body, {
          'x-tenant-id': tenantId,
          'x-agent-id': principal?.id || 'unknown',
        });
        statusCode = res.statusCode;
        resultBody = res.body;
      } else if (request.method === 'PUT') {
        const res = await this.sfaVisitController.handlePutVisit(params.id || '', request.body, {
          'x-tenant-id': tenantId,
        });
        statusCode = res.statusCode;
        resultBody = res.body;
      } else if (request.method === 'GET') {
        const id = params.id;
        if (id) {
          const res = await this.sfaVisitController.handleGetVisit(id, {
            'x-tenant-id': tenantId,
          });
          statusCode = res.statusCode;
          resultBody = res.body;
        } else {
          const res = await this.sfaVisitController.handleListVisits(request.body || {}, {
            'x-tenant-id': tenantId,
          });
          statusCode = res.statusCode;
          resultBody = res.body;
        }
      } else {
        const upstreamResponse = this.forwardToUpstream(handler, request, params);
        return { status: 200, headers: { ...responseHeaders, 'x-upstream-service': handler.targetService }, body: upstreamResponse };
      }

      return { status: statusCode, headers: { ...responseHeaders, 'x-upstream-service': 'sfa-service' }, body: resultBody };
    }

    if (handler.targetService === 'sfa-service' && handler.targetPath === '/beat-routes') {
      let resultBody: any;
      let statusCode = 200;

      if (request.method === 'POST') {
        const res = await this.sfaBeatRouteController.handlePostBeatRoute(request.body, {
          'x-tenant-id': tenantId,
        });
        statusCode = res.statusCode;
        resultBody = res.body;
      } else if (request.method === 'PUT') {
        const res = await this.sfaBeatRouteController.handlePutBeatRoute(params.id || '', request.body, {
          'x-tenant-id': tenantId,
        });
        statusCode = res.statusCode;
        resultBody = res.body;
      } else if (request.method === 'GET') {
        const id = params.id;
        if (id) {
          const res = await this.sfaBeatRouteController.handleGetBeatRoute(id, {
            'x-tenant-id': tenantId,
          });
          statusCode = res.statusCode;
          resultBody = res.body;
        } else {
          const res = await this.sfaBeatRouteController.handleListBeatRoutes(request.body || {}, {
            'x-tenant-id': tenantId,
          });
          statusCode = res.statusCode;
          resultBody = res.body;
        }
      } else if (request.method === 'DELETE') {
        const res = await this.sfaBeatRouteController.handleDeleteBeatRoute(params.id || '', {
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

    if (handler.targetService === 'sfa-service' && handler.targetPath === '/journey-plans') {
      let resultBody: any;
      let statusCode = 200;

      if (request.method === 'POST') {
        const res = await this.sfaJourneyPlanController.handlePostPlan(request.body, {
          'x-tenant-id': tenantId,
          'x-agent-id': principal?.id || 'unknown',
        });
        statusCode = res.statusCode;
        resultBody = res.body;
      } else if (request.method === 'PUT') {
        const res = await this.sfaJourneyPlanController.handlePutPlan(params.id || '', request.body, {
          'x-tenant-id': tenantId,
        });
        statusCode = res.statusCode;
        resultBody = res.body;
      } else if (request.method === 'GET') {
        const id = params.id;
        if (id) {
          const res = await this.sfaJourneyPlanController.handleGetPlan(id, {
            'x-tenant-id': tenantId,
          });
          statusCode = res.statusCode;
          resultBody = res.body;
        } else {
          const res = await this.sfaJourneyPlanController.handleListPlans(request.body || {}, {
            'x-tenant-id': tenantId,
          });
          statusCode = res.statusCode;
          resultBody = res.body;
        }
      } else {
        const upstreamResponse = this.forwardToUpstream(handler, request, params);
        return { status: 200, headers: { ...responseHeaders, 'x-upstream-service': handler.targetService }, body: upstreamResponse };
      }

      return { status: statusCode, headers: { ...responseHeaders, 'x-upstream-service': 'sfa-service' }, body: resultBody };
    }

    if (handler.targetService === 'sfa-service' && handler.targetPath === '/order-approvals') {
      let resultBody: any;
      let statusCode = 200;

      if (request.method === 'POST') {
        const res = await this.sfaOrderApprovalController.handlePostApproval(request.body, {
          'x-tenant-id': tenantId,
          'x-agent-id': principal?.id || 'unknown',
        });
        statusCode = res.statusCode;
        resultBody = res.body;
      } else if (request.method === 'PUT') {
        const res = await this.sfaOrderApprovalController.handlePutApproval(params.id || '', request.body, {
          'x-tenant-id': tenantId,
          'x-agent-id': principal?.id || 'unknown',
        });
        statusCode = res.statusCode;
        resultBody = res.body;
      } else if (request.method === 'GET') {
        const id = params.id;
        if (id) {
          const res = await this.sfaOrderApprovalController.handleGetApproval(id, {
            'x-tenant-id': tenantId,
          });
          statusCode = res.statusCode;
          resultBody = res.body;
        } else {
          const res = await this.sfaOrderApprovalController.handleListApprovals(request.body || {}, {
            'x-tenant-id': tenantId,
          });
          statusCode = res.statusCode;
          resultBody = res.body;
        }
      } else {
        const upstreamResponse = this.forwardToUpstream(handler, request, params);
        return { status: 200, headers: { ...responseHeaders, 'x-upstream-service': handler.targetService }, body: upstreamResponse };
      }

      return { status: statusCode, headers: { ...responseHeaders, 'x-upstream-service': 'sfa-service' }, body: resultBody };
    }

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

    if (handler.targetService === 'claims-service' && handler.targetPath.startsWith('/claims')) {
      let resultBody: any;
      let statusCode = 200;

      if (request.method === 'POST') {
        const subPath = request.path.replace('/api/v1/claims', '');
        const id = params.id;
        if (subPath.endsWith('/validate') && id) {
          const res = await this.claimsController.handleValidateClaim(id, request.body, {
            'x-tenant-id': tenantId,
            'x-agent-id': principal?.id || 'unknown',
          });
          statusCode = res.statusCode;
          resultBody = res.body;
        } else if (subPath.endsWith('/approve') && id) {
          const res = await this.claimsController.handleApproveClaim(id, request.body, {
            'x-tenant-id': tenantId,
            'x-agent-id': principal?.id || 'unknown',
          });
          statusCode = res.statusCode;
          resultBody = res.body;
        } else if (subPath.endsWith('/reject') && id) {
          const res = await this.claimsController.handleRejectClaim(id, request.body, {
            'x-tenant-id': tenantId,
            'x-agent-id': principal?.id || 'unknown',
          });
          statusCode = res.statusCode;
          resultBody = res.body;
        } else if (subPath.endsWith('/settle') && id) {
          const res = await this.claimsController.handleSettleClaim(id, request.body, {
            'x-tenant-id': tenantId,
            'x-agent-id': principal?.id || 'unknown',
          });
          statusCode = res.statusCode;
          resultBody = res.body;
        } else {
          const res = await this.claimsController.handlePostClaim(request.body, {
            'x-tenant-id': tenantId,
            'x-agent-id': principal?.id || 'unknown',
          });
          statusCode = res.statusCode;
          resultBody = res.body;
        }
      } else if (request.method === 'GET') {
        const id = params.id;
        if (id) {
          const res = await this.claimsController.handleGetClaim(id, {
            'x-tenant-id': tenantId,
          });
          statusCode = res.statusCode;
          resultBody = res.body;
        } else {
          const res = await this.claimsController.handleListClaims(request.body || {}, {
            'x-tenant-id': tenantId,
          });
          statusCode = res.statusCode;
          resultBody = res.body;
        }
      } else {
        const upstreamResponse = this.forwardToUpstream(handler, request, params);
        return { status: 200, headers: { ...responseHeaders, 'x-upstream-service': handler.targetService }, body: upstreamResponse };
      }

      return { status: statusCode, headers: { ...responseHeaders, 'x-upstream-service': 'claims-service' }, body: resultBody };
    }

    if (handler.targetService === 'audit-service') {
      let resultBody: any;
      let statusCode = 200;
      const auditController = AuditController.getInstance();

      if (handler.targetPath === '/audit/verify') {
        const res = await auditController.handleVerifyChain();
        statusCode = res.statusCode;
        resultBody = res.body;
      } else if (handler.targetPath === '/audit/tamper') {
        const { blockNumber, alteredData } = request.body as any;
        await auditController.simulateTampering(Number(blockNumber), alteredData);
        statusCode = 200;
        resultBody = { success: true, message: `Block #${blockNumber} tampered successfully` };
      } else {
        const upstreamResponse = this.forwardToUpstream(handler, request, params);
        return { status: 200, headers: { ...responseHeaders, 'x-upstream-service': handler.targetService }, body: upstreamResponse };
      }

      return { status: statusCode, headers: { ...responseHeaders, 'x-upstream-service': 'audit-service' }, body: resultBody };
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

    if (handler.targetService === 'identity-service') {
      let resultBody: any = {};
      let statusCode = 200;

      if (handler.targetPath.startsWith('/users')) {
        const id = params.id;
        if (request.method === 'POST') {
          const res = await this.identityUserController.handlePostUser(request.body, { 'x-tenant-id': tenantId });
          statusCode = res.statusCode;
          resultBody = res.body;
        } else if (request.method === 'GET') {
          if (id) {
            const res = await this.identityUserController.handleGetUser(id, { 'x-tenant-id': tenantId });
            statusCode = res.statusCode;
            resultBody = res.body;
          } else {
            const res = await this.identityUserController.handleListUsers(request.body || {}, { 'x-tenant-id': tenantId });
            statusCode = res.statusCode;
            resultBody = res.body;
          }
        } else if (request.method === 'PUT') {
          const res = await this.identityUserController.handlePutUser(id, request.body, { 'x-tenant-id': tenantId });
          statusCode = res.statusCode;
          resultBody = res.body;
        } else if (request.method === 'DELETE') {
          const res = await this.identityUserController.handleDeleteUser(id, { 'x-tenant-id': tenantId });
          statusCode = res.statusCode;
          resultBody = res.body;
        }
      } else if (handler.targetPath.startsWith('/roles')) {
        const id = params.id;
        if (request.method === 'POST') {
          const res = await this.identityRoleController.handlePostRole(request.body, { 'x-tenant-id': tenantId });
          statusCode = res.statusCode;
          resultBody = res.body;
        } else if (request.method === 'GET') {
          if (id) {
            const res = await this.identityRoleController.handleGetRole(id, { 'x-tenant-id': tenantId });
            statusCode = res.statusCode;
            resultBody = res.body;
          } else {
            const res = await this.identityRoleController.handleListRoles(request.body || {}, { 'x-tenant-id': tenantId });
            statusCode = res.statusCode;
            resultBody = res.body;
          }
        } else if (request.method === 'PUT') {
          const res = await this.identityRoleController.handlePutRole(id, request.body, { 'x-tenant-id': tenantId });
          statusCode = res.statusCode;
          resultBody = res.body;
        } else if (request.method === 'DELETE') {
          const res = await this.identityRoleController.handleDeleteRole(id, { 'x-tenant-id': tenantId });
          statusCode = res.statusCode;
          resultBody = res.body;
        }
      } else if (handler.targetPath.startsWith('/tenants')) {
        const id = params.id;
        if (request.method === 'POST') {
          const res = await this.identityTenantController.handlePostTenant(request.body, { 'x-tenant-id': tenantId });
          statusCode = res.statusCode;
          resultBody = res.body;
        } else if (request.method === 'GET') {
          if (id) {
            const res = await this.identityTenantController.handleGetTenant(id, { 'x-tenant-id': tenantId });
            statusCode = res.statusCode;
            resultBody = res.body;
          } else {
            const res = await this.identityTenantController.handleListTenants(request.body || {}, { 'x-tenant-id': tenantId });
            statusCode = res.statusCode;
            resultBody = res.body;
          }
        } else if (request.method === 'PUT') {
          const res = await this.identityTenantController.handlePutTenant(id, request.body, { 'x-tenant-id': tenantId });
          statusCode = res.statusCode;
          resultBody = res.body;
        } else if (request.method === 'DELETE') {
          const res = await this.identityTenantController.handleDeleteTenant(id, { 'x-tenant-id': tenantId });
          statusCode = res.statusCode;
          resultBody = res.body;
        }
      } else if (handler.targetPath.startsWith('/permissions')) {
        const id = params.id;
        if (request.method === 'POST') {
          const res = await this.identityPermissionController.handlePostPermission(request.body, { 'x-tenant-id': tenantId });
          statusCode = res.statusCode;
          resultBody = res.body;
        } else if (request.method === 'GET') {
          if (id) {
            const res = await this.identityPermissionController.handleGetPermission(id, { 'x-tenant-id': tenantId });
            statusCode = res.statusCode;
            resultBody = res.body;
          } else {
            const res = await this.identityPermissionController.handleListPermissions(request.body || {}, { 'x-tenant-id': tenantId });
            statusCode = res.statusCode;
            resultBody = res.body;
          }
        } else if (request.method === 'PUT') {
          const res = await this.identityPermissionController.handlePutPermission(id, request.body, { 'x-tenant-id': tenantId });
          statusCode = res.statusCode;
          resultBody = res.body;
        } else if (request.method === 'DELETE') {
          const res = await this.identityPermissionController.handleDeletePermission(id, { 'x-tenant-id': tenantId });
          statusCode = res.statusCode;
          resultBody = res.body;
        }
      } else if (handler.targetPath.startsWith('/mfa-devices')) {
        const id = params.id;
        if (request.method === 'POST') {
          const res = await this.identityMfaController.handlePostMFADevice(request.body, { 'x-tenant-id': tenantId });
          statusCode = res.statusCode;
          resultBody = res.body;
        } else if (request.method === 'GET') {
          if (id) {
            const res = await this.identityMfaController.handleGetMFADevice(id, { 'x-tenant-id': tenantId });
            statusCode = res.statusCode;
            resultBody = res.body;
          } else {
            const res = await this.identityMfaController.handleListMFADevices(request.body || {}, { 'x-tenant-id': tenantId });
            statusCode = res.statusCode;
            resultBody = res.body;
          }
        } else if (request.method === 'PUT') {
          const res = await this.identityMfaController.handlePutMFADevice(id, request.body, { 'x-tenant-id': tenantId });
          statusCode = res.statusCode;
          resultBody = res.body;
        } else if (request.method === 'DELETE') {
          const res = await this.identityMfaController.handleDeleteMFADevice(id, { 'x-tenant-id': tenantId });
          statusCode = res.statusCode;
          resultBody = res.body;
        }
      } else if (handler.targetPath.startsWith('/auth')) {
        if (request.path.endsWith('/login') && request.method === 'POST') {
          const res = await this.identityAuthController.handlePostLogin(request.body, { 'x-tenant-id': tenantId });
          statusCode = res.statusCode;
          resultBody = res.body;
        } else if (request.path.endsWith('/verify') && request.method === 'POST') {
          const res = await this.identityAuthController.handlePostVerify(request.body, { 'x-tenant-id': tenantId });
          statusCode = res.statusCode;
          resultBody = res.body;
        } else if (request.path.endsWith('/jwks') && request.method === 'GET') {
          const res = await this.identityAuthController.handleGetJwks();
          statusCode = res.statusCode;
          resultBody = res.body;
        }
      }

      return { status: statusCode, headers: { ...responseHeaders, 'x-upstream-service': 'identity-service' }, body: resultBody };
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
