import { loadConfigSync } from '@dms/pkg-config';
import { PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { CreatePermissionUseCase, GetPermissionUseCase, UpdatePermissionUseCase, DeletePermissionUseCase, ListPermissionsUseCase } from '../../../application/usecases/permission.usecases.js';
import { PermissionPgRepository } from '../../../infrastructure/database/repositories/permission.pg-repository.js';
import { HttpResponse } from './auth.controller.js';

const config = loadConfigSync();

export class PermissionController {
  private db = new PostgresDatabaseClient(config.db, new PgDriver());
  private permissionRepo = new PermissionPgRepository(this.db);
  private createPermissionUseCase = new CreatePermissionUseCase(this.db, this.permissionRepo);
  private getPermissionUseCase = new GetPermissionUseCase(this.permissionRepo);
  private updatePermissionUseCase = new UpdatePermissionUseCase(this.db, this.permissionRepo);
  private deletePermissionUseCase = new DeletePermissionUseCase(this.permissionRepo);
  private listPermissionsUseCase = new ListPermissionsUseCase(this.permissionRepo);

  async handlePostPermission(requestBody: any, headers: Record<string, string>): Promise<HttpResponse> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    try {
      const permission = await this.createPermissionUseCase.execute(tenantId, requestBody);
      return {
        statusCode: 201,
        body: permission as any,
      };
    } catch (err: any) {
      return {
        statusCode: 400,
        body: { message: err.message },
      };
    }
  }

  async handleGetPermission(id: string, headers: Record<string, string>): Promise<HttpResponse> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    try {
      const permission = await this.getPermissionUseCase.execute(id, tenantId);
      return {
        statusCode: 200,
        body: permission as any,
      };
    } catch (err: any) {
      return {
        statusCode: 404,
        body: { message: err.message },
      };
    }
  }

  async handlePutPermission(id: string, requestBody: any, headers: Record<string, string>): Promise<HttpResponse> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    try {
      const permission = await this.updatePermissionUseCase.execute(tenantId, { ...requestBody, id });
      return {
        statusCode: 200,
        body: permission as any,
      };
    } catch (err: any) {
      return {
        statusCode: 400,
        body: { message: err.message },
      };
    }
  }

  async handleDeletePermission(id: string, headers: Record<string, string>): Promise<HttpResponse> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    try {
      const success = await this.deletePermissionUseCase.execute(id, tenantId);
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

  async handleListPermissions(requestBody: any, headers: Record<string, string>): Promise<HttpResponse> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    try {
      const result = await this.listPermissionsUseCase.execute(tenantId, requestBody);
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
