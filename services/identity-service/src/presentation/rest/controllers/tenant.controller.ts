import { CreateTenantUseCase } from '../../../application/usecases/create-tenant.usecase.js';
import { GetTenantUseCase } from '../../../application/usecases/get-tenant.usecase.js';
import { UpdateTenantUseCase } from '../../../application/usecases/update-tenant.usecase.js';
import { ListTenantsUseCase } from '../../../application/usecases/list-tenants.usecase.js';
import { TenantDomainError, TenantValidationError, InvalidTenantStateTransitionError } from '../../../domain/entities/tenant.entity.js';
import { TenantPgRepository } from '../../../infrastructure/database/repositories/tenant.pg-repository.js';
import { Principal } from '../../../application/usecases/create-user.usecase.js';

export class TenantController {
  private createUseCase: CreateTenantUseCase;
  private getUseCase: GetTenantUseCase;
  private updateUseCase: UpdateTenantUseCase;
  private listUseCase: ListTenantsUseCase;
  private repo: TenantPgRepository;

  constructor(
    createUseCase?: CreateTenantUseCase,
    getUseCase?: GetTenantUseCase,
    updateUseCase?: UpdateTenantUseCase,
    listUseCase?: ListTenantsUseCase,
    repo?: TenantPgRepository
  ) {
    this.repo = repo || new TenantPgRepository();
    this.createUseCase = createUseCase || new CreateTenantUseCase(this.repo);
    this.getUseCase = getUseCase || new GetTenantUseCase(this.repo);
    this.updateUseCase = updateUseCase || new UpdateTenantUseCase(this.repo);
    this.listUseCase = listUseCase || new ListTenantsUseCase(this.repo);
  }

  async handlePostTenant(body: any, headers?: any): Promise<{ statusCode: number; body: any }> {
    try {
      const principal = this.extractPrincipalFromHeaders(headers);
      const contentType = headers && headers['content-type'];
      if (contentType && !contentType.includes('application/json')) {
        return { statusCode: 415, body: { error: 'Unsupported Media Type: Content-Type must be application/json' } };
      }
      const tenant = await this.createUseCase.execute(principal, body);
      return { statusCode: 201, body: tenant.toJSON() };
    } catch (err: any) {
      return this.mapError(err);
    }
  }

  async handleGetTenant(id: string, headers?: any): Promise<{ statusCode: number; body: any }> {
    try {
      const principal = this.extractPrincipalFromHeaders(headers);
      const tenant = await this.getUseCase.execute(principal, id);
      return { statusCode: 200, body: tenant.toJSON() };
    } catch (err: any) {
      return this.mapError(err);
    }
  }

  async handleListTenants(queryOrBody?: any, headers?: any): Promise<{ statusCode: number; body: any }> {
    try {
      const principal = this.extractPrincipalFromHeaders(headers);
      const result = await this.listUseCase.execute(principal, queryOrBody || {});
      return { statusCode: 200, body: result.items.map((i: any) => i.toJSON()) };
    } catch (err: any) {
      return this.mapError(err);
    }
  }

  async handlePutTenant(id: string, body: any, headers?: any): Promise<{ statusCode: number; body: any }> {
    try {
      const principal = this.extractPrincipalFromHeaders(headers);
      const contentType = headers && headers['content-type'];
      if (contentType && !contentType.includes('application/json')) {
        return { statusCode: 415, body: { error: 'Unsupported Media Type: Content-Type must be application/json' } };
      }
      const tenant = await this.updateUseCase.execute(principal, id, body);
      return { statusCode: 200, body: tenant.toJSON() };
    } catch (err: any) {
      return this.mapError(err);
    }
  }

  async handleDeleteTenant(id: string, headers?: any): Promise<{ statusCode: number; body: any }> {
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
    const permsStr = (headers && headers['x-user-permissions']) || 'identity:*';

    return {
      userId,
      tenantId,
      roles: rolesStr.split(','),
      permissions: permsStr.split(','),
    };
  }

  private mapError(err: any): { statusCode: number; body: any } {
    if (err instanceof TenantValidationError) {
      return { statusCode: 422, body: { error: err.message, fields: err.fields } };
    }
    if (err instanceof InvalidTenantStateTransitionError) {
      return { statusCode: 409, body: { error: err.message } };
    }
    if (err instanceof TenantDomainError) {
      let statusCode = 400;
      if (err.message.includes('Forbidden')) statusCode = 403;
      else if (err.message.includes('not found')) statusCode = 404;
      else if (err.message.includes('already exists') || err.message.includes('Optimistic')) statusCode = 409;
      else if (err.message.includes('Unsupported Media Type')) statusCode = 415;
      return { statusCode, body: { error: err.message } };
    }
    return { statusCode: 500, body: { error: 'An unexpected internal server error occurred' } };
  }
}
