import { CreatePermissionUseCase } from '../../../application/usecases/create-permission.usecase.js';
import { GetPermissionUseCase } from '../../../application/usecases/get-permission.usecase.js';
import { UpdatePermissionUseCase } from '../../../application/usecases/update-permission.usecase.js';
import { ListPermissionsUseCase } from '../../../application/usecases/list-permissions.usecase.js';
import {
  PermissionDomainError,
  PermissionValidationError,
  InvalidPermissionStateTransitionError,
} from '../../../domain/entities/permission.entity.js';
import { PermissionPgRepository } from '../../../infrastructure/database/repositories/permission.pg-repository.js';
import { Principal } from '../../../application/usecases/create-user.usecase.js';

export class PermissionController {
  private createUseCase: CreatePermissionUseCase;
  private getUseCase: GetPermissionUseCase;
  private updateUseCase: UpdatePermissionUseCase;
  private listUseCase: ListPermissionsUseCase;

  constructor(
    createUseCase?: CreatePermissionUseCase,
    getUseCase?: GetPermissionUseCase,
    updateUseCase?: UpdatePermissionUseCase,
    listUseCase?: ListPermissionsUseCase,
  ) {
    const repo = new PermissionPgRepository();
    this.createUseCase = createUseCase || new CreatePermissionUseCase(repo);
    this.getUseCase = getUseCase || new GetPermissionUseCase(repo);
    this.updateUseCase = updateUseCase || new UpdatePermissionUseCase(repo);
    this.listUseCase = listUseCase || new ListPermissionsUseCase(repo);
  }

  async create(req: any, res: any): Promise<void> {
    try {
      this.validateHeaders(req);
      const principal = this.extractPrincipal(req);
      const correlationId = (req.headers && req.headers['x-correlation-id']) || 'N/A';
      const idempotencyKey = (req.headers && req.headers['x-idempotency-key']) as
        | string
        | undefined;

      const permission = await this.createUseCase.execute(
        principal,
        req.body,
        idempotencyKey,
        correlationId,
      );

      res.status(201).json({
        success: true,
        data: permission.toJSON(),
        correlationId,
      });
    } catch (err: any) {
      this.handleError(err, res, req);
    }
  }

  async getById(req: any, res: any): Promise<void> {
    try {
      const principal = this.extractPrincipal(req);
      const permission = await this.getUseCase.execute(req.params.id, principal);

      res.status(200).json({
        success: true,
        data: permission.toJSON(),
      });
    } catch (err: any) {
      this.handleError(err, res, req);
    }
  }

  async update(req: any, res: any): Promise<void> {
    try {
      this.validateHeaders(req);
      const principal = this.extractPrincipal(req);
      const correlationId = (req.headers && req.headers['x-correlation-id']) || 'N/A';

      const permission = await this.updateUseCase.execute(
        req.params.id,
        principal,
        req.body,
        correlationId,
      );

      res.status(200).json({
        success: true,
        data: permission.toJSON(),
        correlationId,
      });
    } catch (err: any) {
      this.handleError(err, res, req);
    }
  }

  async list(req: any, res: any): Promise<void> {
    try {
      const principal = this.extractPrincipal(req);
      const options = {
        page: req.query?.page ? parseInt(req.query.page, 10) : undefined,
        limit: req.query?.limit ? parseInt(req.query.limit, 10) : undefined,
        status: req.query?.status,
        resource: req.query?.resource,
        searchName: req.query?.searchName,
      };

      const result = await this.listUseCase.execute(principal, options);

      res.status(200).json({
        success: true,
        data: result.items.map((item) => item.toJSON()),
        meta: {
          total: result.total,
          page: result.page,
          limit: result.limit,
        },
      });
    } catch (err: any) {
      this.handleError(err, res, req);
    }
  }

  // --- API Gateway Compatibility Handlers ---

  async handlePostPermission(body: any, headers?: any): Promise<{ statusCode: number; body: any }> {
    try {
      const principal = this.extractPrincipalFromHeaders(headers);
      const permission = await this.createUseCase.execute(principal, body);
      return { statusCode: 201, body: permission.toJSON() };
    } catch (err: any) {
      return { statusCode: 400, body: { error: err.message } };
    }
  }

  async handleGetPermission(id: string, headers?: any): Promise<{ statusCode: number; body: any }> {
    try {
      const principal = this.extractPrincipalFromHeaders(headers);
      const permission = await this.getUseCase.execute(id, principal);
      return { statusCode: 200, body: permission.toJSON() };
    } catch (err: any) {
      return { statusCode: 404, body: { error: err.message } };
    }
  }

  async handleListPermissions(
    queryOrBody?: any,
    headers?: any,
  ): Promise<{ statusCode: number; body: any }> {
    try {
      const principal = this.extractPrincipalFromHeaders(headers);
      const result = await this.listUseCase.execute(principal, queryOrBody || {});
      return { statusCode: 200, body: result.items.map((i) => i.toJSON()) };
    } catch (err: any) {
      return { statusCode: 400, body: { error: err.message } };
    }
  }

  async handlePutPermission(
    id: string,
    body: any,
    headers?: any,
  ): Promise<{ statusCode: number; body: any }> {
    try {
      const principal = this.extractPrincipalFromHeaders(headers);
      const permission = await this.updateUseCase.execute(id, principal, body);
      return { statusCode: 200, body: permission.toJSON() };
    } catch (err: any) {
      return { statusCode: 400, body: { error: err.message } };
    }
  }

  async handleDeletePermission(
    id: string,
    headers?: any,
  ): Promise<{ statusCode: number; body: any }> {
    try {
      const repo = new PermissionPgRepository();
      const tenantId =
        (headers && headers['x-tenant-id']) || '00000000-0000-0000-0000-000000000001';
      const deleted = await repo.delete(id, tenantId);
      return { statusCode: deleted ? 200 : 404, body: { success: deleted } };
    } catch (err: any) {
      return { statusCode: 400, body: { error: err.message } };
    }
  }

  private validateHeaders(req: any): void {
    const contentType = req.headers && req.headers['content-type'];
    if (contentType && !contentType.includes('application/json')) {
      throw new PermissionDomainError(
        'Unsupported Media Type: Content-Type must be application/json',
      );
    }
  }

  private extractPrincipal(req: any): Principal {
    return this.extractPrincipalFromHeaders(req.headers);
  }

  private extractPrincipalFromHeaders(headers: any): Principal {
    const tenantId = (headers && headers['x-tenant-id']) || '00000000-0000-0000-0000-000000000001';
    const userId = (headers && headers['x-user-id']) || 'user-default';
    const rolesStr = (headers && headers['x-user-roles']) || 'admin';
    const permsStr = (headers && headers['x-user-permissions']) || 'identity:*';

    return {
      userId,
      tenantId,
      roles: rolesStr.split(','),
      permissions: permsStr.split(','),
    };
  }

  private handleError(err: any, res: any, req: any): void {
    const correlationId = (req.headers && req.headers['x-correlation-id']) || 'N/A';

    if (err instanceof PermissionValidationError) {
      res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: err.message,
          fields: err.fields,
        },
        correlationId,
      });
      return;
    }

    if (err instanceof InvalidPermissionStateTransitionError) {
      res.status(409).json({
        success: false,
        error: {
          code: 'INVALID_STATE_TRANSITION',
          message: err.message,
        },
        correlationId,
      });
      return;
    }

    if (err instanceof PermissionDomainError) {
      let statusCode = 400;
      if (err.message.includes('Forbidden')) statusCode = 403;
      else if (err.message.includes('not found')) statusCode = 404;
      else if (err.message.includes('already exists') || err.message.includes('Optimistic'))
        statusCode = 409;
      else if (err.message.includes('Unsupported Media Type')) statusCode = 415;

      res.status(statusCode).json({
        success: false,
        error: {
          code: 'DOMAIN_ERROR',
          message: err.message,
        },
        correlationId,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected internal server error occurred',
      },
      correlationId,
    });
  }
}
