import { CreateFeatureFlagUseCase } from '../../../application/usecases/create-feature-flag.usecase.js';
import { GetFeatureFlagUseCase } from '../../../application/usecases/get-feature-flag.usecase.js';
import { UpdateFeatureFlagUseCase } from '../../../application/usecases/update-feature-flag.usecase.js';
import { ListFeatureFlagsUseCase } from '../../../application/usecases/list-feature-flags.usecase.js';
import { CreateFeatureFlagDto, ListFeatureFlagsQueryDto, UpdateFeatureFlagDto } from '../../../application/dtos/feature_flag.dto.js';
import { Principal } from '../../../application/usecases/create-config-entry.usecase.js';
import { HttpRequest, HttpResponse } from './config_entry.controller.js';

export class FeatureFlagController {
  constructor(
    private readonly createUseCase: CreateFeatureFlagUseCase,
    private readonly getUseCase: GetFeatureFlagUseCase,
    private readonly updateUseCase: UpdateFeatureFlagUseCase,
    private readonly listUseCase: ListFeatureFlagsUseCase
  ) {}

  public async handleCreate(req: HttpRequest): Promise<HttpResponse> {
    try {
      const contentType = req.headers['content-type'] || req.headers['Content-Type'];
      if (!contentType || !contentType.includes('application/json')) {
        return {
          statusCode: 415,
          body: {
            timestamp: new Date().toISOString(),
            status_code: 415,
            error_code: 'UNSUPPORTED_MEDIA_TYPE',
            message: 'Content-Type must be application/json'
          }
        };
      }

      const principal = this.extractPrincipal(req);
      const dto: CreateFeatureFlagDto = req.body;
      const idempotencyKey = req.headers['x-idempotency-key'] || req.headers['X-Idempotency-Key'];
      if (idempotencyKey) {
        dto.idempotencyKey = idempotencyKey;
      }

      const result = await this.createUseCase.execute(principal, dto);
      return {
        statusCode: 201,
        headers: { 'Content-Type': 'application/json' },
        body: result
      };
    } catch (err: any) {
      return this.mapErrorToResponse(err);
    }
  }

  public async handleGetById(req: HttpRequest): Promise<HttpResponse> {
    try {
      const principal = this.extractPrincipal(req);
      const id = req.params?.id;
      if (!id) {
        return {
          statusCode: 400,
          body: {
            timestamp: new Date().toISOString(),
            status_code: 400,
            error_code: 'BAD_REQUEST',
            message: 'FeatureFlag ID route parameter is required.'
          }
        };
      }

      const result = await this.getUseCase.execute(principal, id);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: result
      };
    } catch (err: any) {
      return this.mapErrorToResponse(err);
    }
  }

  public async handleGetByKey(req: HttpRequest): Promise<HttpResponse> {
    try {
      const principal = this.extractPrincipal(req);
      const key = req.params?.key;
      if (!key) {
        return {
          statusCode: 400,
          body: {
            timestamp: new Date().toISOString(),
            status_code: 400,
            error_code: 'BAD_REQUEST',
            message: 'FeatureFlag key route parameter is required.'
          }
        };
      }

      const result = await this.getUseCase.getByKey(principal, key);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: result
      };
    } catch (err: any) {
      return this.mapErrorToResponse(err);
    }
  }

  public async handleUpdate(req: HttpRequest): Promise<HttpResponse> {
    try {
      const principal = this.extractPrincipal(req);
      const id = req.params?.id;
      if (!id) {
        return {
          statusCode: 400,
          body: {
            timestamp: new Date().toISOString(),
            status_code: 400,
            error_code: 'BAD_REQUEST',
            message: 'FeatureFlag ID route parameter is required.'
          }
        };
      }

      const dto: UpdateFeatureFlagDto = req.body;
      const result = await this.updateUseCase.execute(principal, id, dto);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: result
      };
    } catch (err: any) {
      return this.mapErrorToResponse(err);
    }
  }

  public async handleDelete(req: HttpRequest): Promise<HttpResponse> {
    try {
      const principal = this.extractPrincipal(req);
      const id = req.params?.id;
      if (!id) {
        return {
          statusCode: 400,
          body: {
            timestamp: new Date().toISOString(),
            status_code: 400,
            error_code: 'BAD_REQUEST',
            message: 'FeatureFlag ID route parameter is required.'
          }
        };
      }

      const deleted = await this.updateUseCase.deleteFlag(principal, id);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: { success: deleted, message: 'FeatureFlag deleted successfully' }
      };
    } catch (err: any) {
      return this.mapErrorToResponse(err);
    }
  }

  public async handleList(req: HttpRequest): Promise<HttpResponse> {
    try {
      const principal = this.extractPrincipal(req);
      const query: ListFeatureFlagsQueryDto = {
        flagKey: req.query?.flagKey,
        strategy: req.query?.strategy,
        status: req.query?.status,
        enabled: req.query?.enabled !== undefined ? req.query.enabled === 'true' : undefined,
        page: req.query?.page ? parseInt(req.query.page, 10) : undefined,
        pageSize: req.query?.pageSize ? parseInt(req.query.pageSize, 10) : undefined
      };

      const result = await this.listUseCase.execute(principal, query);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: result
      };
    } catch (err: any) {
      return this.mapErrorToResponse(err);
    }
  }

  private extractPrincipal(req: HttpRequest): Principal {
    if (req.principal) return req.principal;

    const tenantId = req.headers['x-tenant-id'] || req.headers['X-Tenant-ID'] || '00000000-0000-0000-0000-000000000001';
    const userId = req.headers['x-user-id'] || req.headers['X-User-ID'] || 'user-default';
    const roles = (req.headers['x-user-roles'] || 'admin').split(',');
    const permissions = (req.headers['x-user-permissions'] || 'flag:create,flag:read,flag:update,flag:delete').split(',');

    return { userId, tenantId, roles, permissions };
  }

  private mapErrorToResponse(err: Error): HttpResponse {
    const msg = err.message;
    let statusCode = 500;
    let errorCode = 'INTERNAL_SERVER_ERROR';

    if (msg.includes('Unauthorized')) {
      statusCode = 401;
      errorCode = 'UNAUTHORIZED';
    } else if (msg.includes('Forbidden')) {
      statusCode = 403;
      errorCode = 'FORBIDDEN';
    } else if (msg.includes('not found')) {
      statusCode = 404;
      errorCode = 'NOT_FOUND';
    } else if (msg.includes('Optimistic locking failure') || msg.includes('Duplicate request') || msg.includes('already exists')) {
      statusCode = 409;
      errorCode = 'CONFLICT';
    } else if (msg.includes('Invalid') || msg.includes('required') || msg.includes('must be')) {
      statusCode = 400;
      errorCode = 'BAD_REQUEST';
    }

    return {
      statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: {
        timestamp: new Date().toISOString(),
        status_code: statusCode,
        error_code: errorCode,
        message: msg
      }
    };
  }
}
