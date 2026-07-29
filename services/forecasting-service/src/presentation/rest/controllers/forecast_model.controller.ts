import { CreateForecastModelUseCase, Principal } from '../../../application/usecases/create-forecast-model.usecase.js';
import { GetForecastModelUseCase } from '../../../application/usecases/get-forecast-model.usecase.js';
import { UpdateForecastModelUseCase } from '../../../application/usecases/update-forecast-model.usecase.js';
import { ListForecastModelsUseCase } from '../../../application/usecases/list-forecast-models.usecase.js';
import { CreateForecastModelDto, ListForecastModelsQueryDto, UpdateForecastModelDto } from '../../../application/dtos/forecast_model.dto.js';

export interface HttpRequest {
  headers: Record<string, string>;
  params?: Record<string, string>;
  query?: Record<string, any>;
  body?: any;
  principal?: Principal;
}

export interface HttpResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: any;
}

export class ForecastModelController {
  constructor(
    private readonly createUseCase: CreateForecastModelUseCase,
    private readonly getUseCase: GetForecastModelUseCase,
    private readonly updateUseCase: UpdateForecastModelUseCase,
    private readonly listUseCase: ListForecastModelsUseCase
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
      const dto: CreateForecastModelDto = req.body;
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
            message: 'ForecastModel ID route parameter is required.'
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
            message: 'ForecastModel ID route parameter is required.'
          }
        };
      }

      const dto: UpdateForecastModelDto = req.body;
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

  public async handleApprove(req: HttpRequest): Promise<HttpResponse> {
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
            message: 'ForecastModel ID route parameter is required.'
          }
        };
      }

      const expectedVersion = req.body?.expectedVersion ?? 1;
      const result = await this.updateUseCase.approveModel(principal, id, expectedVersion);
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
            message: 'ForecastModel ID route parameter is required.'
          }
        };
      }

      const deleted = await this.updateUseCase.deleteModel(principal, id);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: { success: deleted, message: 'ForecastModel deleted successfully' }
      };
    } catch (err: any) {
      return this.mapErrorToResponse(err);
    }
  }

  public async handleList(req: HttpRequest): Promise<HttpResponse> {
    try {
      const principal = this.extractPrincipal(req);
      const query: ListForecastModelsQueryDto = {
        modelName: req.query?.modelName,
        algorithm: req.query?.algorithm,
        status: req.query?.status,
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
    const permissions = (req.headers['x-user-permissions'] || 'forecast:model:create,forecast:model:read,forecast:model:update,forecast:model:delete').split(',');

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
