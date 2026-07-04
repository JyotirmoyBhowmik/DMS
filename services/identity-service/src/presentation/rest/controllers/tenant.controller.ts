import { loadConfigSync } from '@dms/pkg-config';
import { PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { CreateTenantUseCase, GetTenantUseCase, UpdateTenantUseCase, DeleteTenantUseCase, ListTenantsUseCase } from '../../../application/usecases/tenant.usecases.js';
import { TenantPgRepository } from '../../../infrastructure/database/repositories/tenant.pg-repository.js';
import { HttpResponse } from './auth.controller.js';

const config = loadConfigSync();

export class TenantController {
  private db = new PostgresDatabaseClient(config.db, new PgDriver());
  private tenantRepo = new TenantPgRepository(this.db);
  private createTenantUseCase = new CreateTenantUseCase(this.db, this.tenantRepo);
  private getTenantUseCase = new GetTenantUseCase(this.tenantRepo);
  private updateTenantUseCase = new UpdateTenantUseCase(this.db, this.tenantRepo);
  private deleteTenantUseCase = new DeleteTenantUseCase(this.tenantRepo);
  private listTenantsUseCase = new ListTenantsUseCase(this.tenantRepo);

  async handlePostTenant(requestBody: any, headers: Record<string, string>): Promise<HttpResponse> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    try {
      const tenant = await this.createTenantUseCase.execute(tenantId, requestBody);
      return {
        statusCode: 201,
        body: tenant as any,
      };
    } catch (err: any) {
      return {
        statusCode: 400,
        body: { message: err.message },
      };
    }
  }

  async handleGetTenant(id: string, headers: Record<string, string>): Promise<HttpResponse> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    try {
      const tenant = await this.getTenantUseCase.execute(id, tenantId);
      return {
        statusCode: 200,
        body: tenant as any,
      };
    } catch (err: any) {
      return {
        statusCode: 404,
        body: { message: err.message },
      };
    }
  }

  async handlePutTenant(id: string, requestBody: any, headers: Record<string, string>): Promise<HttpResponse> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    try {
      const tenant = await this.updateTenantUseCase.execute(tenantId, { ...requestBody, id });
      return {
        statusCode: 200,
        body: tenant as any,
      };
    } catch (err: any) {
      return {
        statusCode: 400,
        body: { message: err.message },
      };
    }
  }

  async handleDeleteTenant(id: string, headers: Record<string, string>): Promise<HttpResponse> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    try {
      const success = await this.deleteTenantUseCase.execute(id, tenantId);
      return {
        statusCode: success ? 200 : 404,
        body: { success },
      };
    } catch (err: any) {
      return {
        statusCode: 400,
        body: { message: err.message },
      };
    }
  }

  async handleListTenants(requestBody: any, headers: Record<string, string>): Promise<HttpResponse> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    try {
      const result = await this.listTenantsUseCase.execute(tenantId, requestBody);
      return {
        statusCode: 200,
        body: result as any,
      };
    } catch (err: any) {
      return {
        statusCode: 400,
        body: { message: err.message },
      };
    }
  }
}
