import { loadConfigSync } from '@dms/pkg-config';
import { PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { CreateRoleUseCase, GetRoleUseCase, UpdateRoleUseCase, DeleteRoleUseCase, ListRolesUseCase } from '../../../application/usecases/role.usecases.js';
import { RolePgRepository } from '../../../infrastructure/database/repositories/role.pg-repository.js';
import { HttpResponse } from './auth.controller.js';

const config = loadConfigSync();

export class RoleController {
  private db = new PostgresDatabaseClient(config.db, new PgDriver());
  private roleRepo = new RolePgRepository(this.db);
  private createRoleUseCase = new CreateRoleUseCase(this.db, this.roleRepo);
  private getRoleUseCase = new GetRoleUseCase(this.roleRepo);
  private updateRoleUseCase = new UpdateRoleUseCase(this.db, this.roleRepo);
  private deleteRoleUseCase = new DeleteRoleUseCase(this.roleRepo);
  private listRolesUseCase = new ListRolesUseCase(this.roleRepo);

  async handlePostRole(requestBody: any, headers: Record<string, string>): Promise<HttpResponse> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    try {
      const role = await this.createRoleUseCase.execute(tenantId, requestBody);
      return {
        statusCode: 201,
        body: role as any,
      };
    } catch (err: any) {
      return {
        statusCode: 400,
        body: { message: err.message },
      };
    }
  }

  async handleGetRole(id: string, headers: Record<string, string>): Promise<HttpResponse> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    try {
      const role = await this.getRoleUseCase.execute(id, tenantId);
      return {
        statusCode: 200,
        body: role as any,
      };
    } catch (err: any) {
      return {
        statusCode: 404,
        body: { message: err.message },
      };
    }
  }

  async handlePutRole(id: string, requestBody: any, headers: Record<string, string>): Promise<HttpResponse> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    try {
      const role = await this.updateRoleUseCase.execute(tenantId, { ...requestBody, id });
      return {
        statusCode: 200,
        body: role as any,
      };
    } catch (err: any) {
      return {
        statusCode: 400,
        body: { message: err.message },
      };
    }
  }

  async handleDeleteRole(id: string, headers: Record<string, string>): Promise<HttpResponse> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    try {
      const success = await this.deleteRoleUseCase.execute(id, tenantId);
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

  async handleListRoles(requestBody: any, headers: Record<string, string>): Promise<HttpResponse> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    try {
      const result = await this.listRolesUseCase.execute(tenantId, requestBody);
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
