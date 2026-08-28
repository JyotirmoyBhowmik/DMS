import { StructuredLogger } from '@dms/pkg-logger';
import {
  GetUserScopeUseCase,
  UpsertUserScopeUseCase,
} from '../../../application/usecases/user_scope.usecases.js';
import { InMemoryUserScopeRepository } from '../../../infrastructure/database/repositories/user_scope.memory-repository.js';

export interface HttpResponse {
  statusCode: number;
  body: Record<string, unknown>;
}

export class UserScopeController {
  private logger = new StructuredLogger('UserScopeController');
  private repo = new InMemoryUserScopeRepository();
  private upsertUseCase = new UpsertUserScopeUseCase(this.repo);
  private getUseCase = new GetUserScopeUseCase(this.repo);

  async handlePutUserScope(
    userId: string,
    body: unknown,
    headers: Record<string, string>,
  ): Promise<HttpResponse> {
    const tenantId = headers['x-tenant-id'] ?? '';
    const rolesHeader = headers['x-user-roles'] ?? 'admin';
    const principal = {
      id: headers['x-user-id'] ?? 'system',
      tenantId,
      roles: rolesHeader.split(',').filter(Boolean),
    };

    try {
      const scope = await this.upsertUseCase.execute(principal, { ...(body as object), userId });
      return { statusCode: 200, body: { success: true, scope } };
    } catch (err: unknown) {
      this.logger.warn('Failed to upsert user scope', { error: (err as Error).message });
      return { statusCode: 403, body: { error: (err as Error).message } };
    }
  }

  async handleGetUserScope(userId: string, headers: Record<string, string>): Promise<HttpResponse> {
    const tenantId = headers['x-tenant-id'] ?? '';
    const rolesHeader = headers['x-user-roles'] ?? 'agent';
    try {
      const scope = await this.getUseCase.execute(
        tenantId,
        userId,
        rolesHeader.split(',').filter(Boolean),
      );
      return { statusCode: 200, body: { userId, scope } };
    } catch (err: unknown) {
      return { statusCode: 500, body: { error: (err as Error).message } };
    }
  }
}
