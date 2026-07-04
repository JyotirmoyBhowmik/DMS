import { loadConfigSync } from '@dms/pkg-config';
import { PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { CreateUserUseCase, GetUserUseCase, UpdateUserUseCase, DeleteUserUseCase, ListUsersUseCase } from '../../../application/usecases/user.usecases.js';
import { UserPgRepository } from '../../../infrastructure/database/repositories/user.pg-repository.js';
import { HttpResponse } from './auth.controller.js';

const config = loadConfigSync();

export class UserController {
  private db = new PostgresDatabaseClient(config.db, new PgDriver());
  private userRepo = new UserPgRepository(this.db);
  private createUserUseCase = new CreateUserUseCase(this.db, this.userRepo);
  private getUserUseCase = new GetUserUseCase(this.userRepo);
  private updateUserUseCase = new UpdateUserUseCase(this.db, this.userRepo);
  private deleteUserUseCase = new DeleteUserUseCase(this.userRepo);
  private listUsersUseCase = new ListUsersUseCase(this.userRepo);

  async handlePostUser(requestBody: any, headers: Record<string, string>): Promise<HttpResponse> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    try {
      const user = await this.createUserUseCase.execute(tenantId, requestBody);
      return {
        statusCode: 201,
        body: user as any,
      };
    } catch (err: any) {
      return {
        statusCode: 400,
        body: { message: err.message },
      };
    }
  }

  async handleGetUser(id: string, headers: Record<string, string>): Promise<HttpResponse> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    try {
      const user = await this.getUserUseCase.execute(id, tenantId);
      return {
        statusCode: 200,
        body: user as any,
      };
    } catch (err: any) {
      return {
        statusCode: 404,
        body: { message: err.message },
      };
    }
  }

  async handlePutUser(id: string, requestBody: any, headers: Record<string, string>): Promise<HttpResponse> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    try {
      const user = await this.updateUserUseCase.execute(tenantId, { ...requestBody, id });
      return {
        statusCode: 200,
        body: user as any,
      };
    } catch (err: any) {
      return {
        statusCode: 400,
        body: { message: err.message },
      };
    }
  }

  async handleDeleteUser(id: string, headers: Record<string, string>): Promise<HttpResponse> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    try {
      const success = await this.deleteUserUseCase.execute(id, tenantId);
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

  async handleListUsers(requestBody: any, headers: Record<string, string>): Promise<HttpResponse> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    try {
      const result = await this.listUsersUseCase.execute(tenantId, requestBody);
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
