import { CreateNotificationTemplateUseCase, Principal } from '../../../application/usecases/create-notification-template.usecase.js';
import { GetNotificationTemplateUseCase } from '../../../application/usecases/get-notification-template.usecase.js';
import { UpdateNotificationTemplateUseCase } from '../../../application/usecases/update-notification-template.usecase.js';
import { ListNotificationTemplatesUseCase } from '../../../application/usecases/list-notification-templates.usecase.js';
import { NotificationTemplateDomainError, NotificationTemplateValidationError } from '../../../domain/entities/notification_template.entity.js';
import { NotificationTemplatePgRepository } from '../../../infrastructure/database/repositories/notification_template.pg-repository.js';

export class NotificationTemplateController {
  private createUseCase: CreateNotificationTemplateUseCase;
  private getUseCase: GetNotificationTemplateUseCase;
  private updateUseCase: UpdateNotificationTemplateUseCase;
  private listUseCase: ListNotificationTemplatesUseCase;
  private repo: NotificationTemplatePgRepository;

  constructor(
    createUseCase?: CreateNotificationTemplateUseCase,
    getUseCase?: GetNotificationTemplateUseCase,
    updateUseCase?: UpdateNotificationTemplateUseCase,
    listUseCase?: ListNotificationTemplatesUseCase,
    repo?: NotificationTemplatePgRepository
  ) {
    this.repo = repo || new NotificationTemplatePgRepository();
    this.createUseCase = createUseCase || new CreateNotificationTemplateUseCase(this.repo);
    this.getUseCase = getUseCase || new GetNotificationTemplateUseCase(this.repo);
    this.updateUseCase = updateUseCase || new UpdateNotificationTemplateUseCase(this.repo);
    this.listUseCase = listUseCase || new ListNotificationTemplatesUseCase(this.repo);
  }

  async handlePostNotificationTemplate(body: any, headers?: any): Promise<{ statusCode: number; body: any }> {
    try {
      const contentType = headers && (headers['content-type'] || headers['Content-Type']);
      if (contentType && !contentType.includes('application/json')) {
        return {
          statusCode: 415,
          body: { success: false, error: { message: 'Unsupported Media Type: Content-Type must be application/json' } }
        };
      }

      const principal = this.extractPrincipalFromHeaders(headers);
      const idempotencyKey = headers && headers['x-idempotency-key'];
      const result = await this.createUseCase.execute(principal, body, idempotencyKey);
      return { statusCode: 201, body: result.toJSON() };
    } catch (err: any) {
      return this.mapError(err);
    }
  }

  async handleGetNotificationTemplate(id: string, headers?: any): Promise<{ statusCode: number; body: any }> {
    try {
      const principal = this.extractPrincipalFromHeaders(headers);
      const result = await this.getUseCase.execute(id, principal);
      return { statusCode: 200, body: result.toJSON() };
    } catch (err: any) {
      return this.mapError(err);
    }
  }

  async handleListNotificationTemplates(query?: any, headers?: any): Promise<{ statusCode: number; body: any }> {
    try {
      const principal = this.extractPrincipalFromHeaders(headers);
      const options = {
        page: query?.page ? parseInt(query.page, 10) : 1,
        limit: query?.limit ? parseInt(query.limit, 10) : 20,
        channel: query?.channel,
        status: query?.status,
        code: query?.code,
      };
      const result = await this.listUseCase.execute(principal, options);
      return {
        statusCode: 200,
        body: {
          items: result.items.map(item => item.toJSON()),
          total: result.total,
          page: options.page,
          limit: options.limit,
        }
      };
    } catch (err: any) {
      return this.mapError(err);
    }
  }

  async handlePutNotificationTemplate(id: string, body: any, headers?: any): Promise<{ statusCode: number; body: any }> {
    try {
      const contentType = headers && (headers['content-type'] || headers['Content-Type']);
      if (contentType && !contentType.includes('application/json')) {
        return {
          statusCode: 415,
          body: { success: false, error: { message: 'Unsupported Media Type: Content-Type must be application/json' } }
        };
      }

      const principal = this.extractPrincipalFromHeaders(headers);
      const result = await this.updateUseCase.execute(id, principal, body);
      return { statusCode: 200, body: result.toJSON() };
    } catch (err: any) {
      return this.mapError(err);
    }
  }

  async handleDeleteNotificationTemplate(id: string, headers?: any): Promise<{ statusCode: number; body: any }> {
    try {
      const tenantId = (headers && headers['x-tenant-id']) || '00000000-0000-0000-0000-000000000001';
      const deleted = await this.repo.delete(id, tenantId);
      return { statusCode: deleted ? 200 : 404, body: { success: deleted } };
    } catch (err: any) {
      return this.mapError(err);
    }
  }

  private extractPrincipalFromHeaders(headers: any): Principal {
    const tenantId = (headers && headers['x-tenant-id']) || '00000000-0000-0000-0000-000000000001';
    const userId = (headers && headers['x-user-id']) || 'user-default';
    const rolesStr = (headers && headers['x-user-roles']) || 'admin';
    const permsStr = (headers && headers['x-user-permissions']) || 'notification:*';

    return {
      userId,
      tenantId,
      roles: rolesStr.split(',').map((r: string) => r.trim()),
      permissions: permsStr.split(',').map((p: string) => p.trim()),
    };
  }

  private mapError(err: any): { statusCode: number; body: any } {
    if (err instanceof NotificationTemplateValidationError) {
      return { statusCode: 422, body: { success: false, error: { message: err.message, fields: err.fields } } };
    }

    if (err instanceof NotificationTemplateDomainError) {
      if (err.message.startsWith('Forbidden')) {
        return { statusCode: 403, body: { success: false, error: { message: err.message } } };
      }
      if (err.message.startsWith('Unauthorized')) {
        return { statusCode: 401, body: { success: false, error: { message: err.message } } };
      }
      if (err.message.includes('not found')) {
        return { statusCode: 404, body: { success: false, error: { message: err.message } } };
      }
      if (err.message.startsWith('Conflict') || err.message.includes('Optimistic concurrency')) {
        return { statusCode: 409, body: { success: false, error: { message: err.message } } };
      }
      return { statusCode: 400, body: { success: false, error: { message: err.message } } };
    }

    return { statusCode: 500, body: { success: false, error: { message: err.message || 'Internal Server Error' } } };
  }
}
