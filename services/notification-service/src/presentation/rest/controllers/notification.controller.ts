import { CreateNotificationUseCase, Principal } from '../../../application/usecases/create-notification.usecase.js';
import { GetNotificationUseCase } from '../../../application/usecases/get-notification.usecase.js';
import { UpdateNotificationUseCase } from '../../../application/usecases/update-notification.usecase.js';
import { ListNotificationsUseCase } from '../../../application/usecases/list-notifications.usecase.js';
import { CreateNotificationDto, ListNotificationsQueryDto, TransitionNotificationStatusDto, UpdateNotificationDto } from '../../../application/dtos/notification.dto.js';

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

export class NotificationController {
  constructor(
    private readonly createUseCase: CreateNotificationUseCase,
    private readonly getUseCase: GetNotificationUseCase,
    private readonly updateUseCase: UpdateNotificationUseCase,
    private readonly listUseCase: ListNotificationsUseCase
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
      const dto: CreateNotificationDto = req.body;
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
            message: 'Notification ID route parameter is required.'
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
            message: 'Notification ID route parameter is required.'
          }
        };
      }

      const dto: UpdateNotificationDto = req.body;
      const result = await this.updateUseCase.updatePayload(principal, id, dto);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: result
      };
    } catch (err: any) {
      return this.mapErrorToResponse(err);
    }
  }

  public async handleTransitionStatus(req: HttpRequest): Promise<HttpResponse> {
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
            message: 'Notification ID route parameter is required.'
          }
        };
      }

      const dto: TransitionNotificationStatusDto = req.body;
      const result = await this.updateUseCase.transitionStatus(principal, id, dto);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: result
      };
    } catch (err: any) {
      return this.mapErrorToResponse(err);
    }
  }

  public async handleList(req: HttpRequest): Promise<HttpResponse> {
    try {
      const principal = this.extractPrincipal(req);
      const query: ListNotificationsQueryDto = {
        recipient: req.query?.recipient,
        channel: req.query?.channel,
        status: req.query?.status,
        templateId: req.query?.templateId,
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
    const permissions = (req.headers['x-user-permissions'] || 'notification:create,notification:read,notification:update').split(',');

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
    } else if (msg.includes('Optimistic locking failure') || msg.includes('Duplicate request')) {
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
