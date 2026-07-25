import { OutstandingRepository } from '../../../domain/repositories/outstanding.repository.js';
import { CreateOutstandingUseCase } from '../../../application/usecases/create-outstanding.usecase.js';
import { GetOutstandingUseCase } from '../../../application/usecases/get-outstanding.usecase.js';
import { UpdateOutstandingUseCase } from '../../../application/usecases/update-outstanding.usecase.js';
import { ListOutstandingsUseCase } from '../../../application/usecases/list-outstandings.usecase.js';
import { Principal } from '../../../application/usecases/create-invoice.usecase.js';
import { OutstandingDomainError, InvalidOutstandingStateTransitionError, OutstandingValidationError } from '../../../domain/entities/outstanding.entity.js';

export interface HttpResponse {
  statusCode: number;
  body: any;
  headers?: Record<string, string>;
}

export class OutstandingController {
  private createUseCase: CreateOutstandingUseCase;
  private getUseCase: GetOutstandingUseCase;
  private updateUseCase: UpdateOutstandingUseCase;
  private listUseCase: ListOutstandingsUseCase;

  constructor(repository: OutstandingRepository) {
    this.createUseCase = new CreateOutstandingUseCase(repository);
    this.getUseCase = new GetOutstandingUseCase(repository);
    this.updateUseCase = new UpdateOutstandingUseCase(repository);
    this.listUseCase = new ListOutstandingsUseCase(repository);
  }

  private resolvePrincipal(headers: Record<string, string | string[] | undefined>): Principal {
    const tenantId = (headers['x-tenant-id'] as string) || '';
    const userId = (headers['x-user-id'] as string) || 'anonymous';
    const rolesHeader = (headers['x-user-roles'] as string) || '';
    const permsHeader = (headers['x-user-permissions'] as string) || '';

    const roles = rolesHeader ? rolesHeader.split(',').map(r => r.trim()) : [];
    const permissions = permsHeader ? permsHeader.split(',').map(p => p.trim()) : [];

    return {
      userId,
      tenantId,
      roles,
      permissions,
    };
  }

  private checkContentType(headers: Record<string, string | string[] | undefined>): boolean {
    const contentType = (headers['content-type'] as string) || '';
    return contentType.includes('application/json');
  }

  private formatErrorResponse(error: any): HttpResponse {
    const correlationId = (error.correlationId as string) || `err-${Date.now()}`;

    if (error instanceof OutstandingValidationError) {
      return {
        statusCode: 400,
        body: {
          error: 'VALIDATION_ERROR',
          message: error.message,
          fields: error.fields,
          correlationId,
        },
      };
    }

    if (error instanceof InvalidOutstandingStateTransitionError) {
      return {
        statusCode: 409,
        body: {
          error: 'INVALID_STATE_TRANSITION',
          message: error.message,
          correlationId,
        },
      };
    }

    if (error instanceof OutstandingDomainError) {
      const msg = error.message.toLowerCase();
      let statusCode = 400;
      if (msg.includes('forbidden') || msg.includes('insufficient permissions')) statusCode = 403;
      if (msg.includes('not found')) statusCode = 404;
      if (msg.includes('already exists') || msg.includes('version conflict')) statusCode = 409;

      return {
        statusCode,
        body: {
          error: statusCode === 403 ? 'FORBIDDEN' : statusCode === 404 ? 'NOT_FOUND' : statusCode === 409 ? 'CONFLICT' : 'BAD_REQUEST',
          message: error.message,
          correlationId,
        },
      };
    }

    return {
      statusCode: 500,
      body: {
        error: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected internal error occurred.',
        correlationId,
      },
    };
  }

  async handleCreate(body: any, headers: Record<string, string | string[] | undefined>): Promise<HttpResponse> {
    if (!this.checkContentType(headers)) {
      return {
        statusCode: 415,
        body: { error: 'UNSUPPORTED_MEDIA_TYPE', message: 'Content-Type must be application/json' },
      };
    }

    try {
      const principal = this.resolvePrincipal(headers);
      const idempotencyKey = headers['x-idempotency-key'] as string;
      const correlationId = (headers['x-correlation-id'] as string) || `corr-${Date.now()}`;

      const created = await this.createUseCase.execute(principal, body, idempotencyKey, correlationId);

      return {
        statusCode: 201,
        body: {
          success: true,
          outstanding: created.toJSON(),
        },
      };
    } catch (err) {
      return this.formatErrorResponse(err);
    }
  }

  async handleGet(id: string, headers: Record<string, string | string[] | undefined>): Promise<HttpResponse> {
    try {
      const principal = this.resolvePrincipal(headers);
      const outstanding = await this.getUseCase.execute(principal, id);

      return {
        statusCode: 200,
        body: {
          success: true,
          outstanding: outstanding.toJSON(),
        },
      };
    } catch (err) {
      return this.formatErrorResponse(err);
    }
  }

  async handleUpdate(id: string, body: any, headers: Record<string, string | string[] | undefined>): Promise<HttpResponse> {
    if (!this.checkContentType(headers)) {
      return {
        statusCode: 415,
        body: { error: 'UNSUPPORTED_MEDIA_TYPE', message: 'Content-Type must be application/json' },
      };
    }

    try {
      const principal = this.resolvePrincipal(headers);
      const correlationId = (headers['x-correlation-id'] as string) || `corr-${Date.now()}`;

      const updated = await this.updateUseCase.execute(principal, id, body, correlationId);

      return {
        statusCode: 200,
        body: {
          success: true,
          outstanding: updated.toJSON(),
        },
      };
    } catch (err) {
      return this.formatErrorResponse(err);
    }
  }

  async handleList(query: any, headers: Record<string, string | string[] | undefined>): Promise<HttpResponse> {
    try {
      const principal = this.resolvePrincipal(headers);
      const result = await this.listUseCase.execute(principal, query);

      return {
        statusCode: 200,
        body: {
          success: true,
          data: result.data.map(item => item.toJSON()),
          total: result.total,
          page: result.page,
          limit: result.limit,
        },
      };
    } catch (err) {
      return this.formatErrorResponse(err);
    }
  }
}
