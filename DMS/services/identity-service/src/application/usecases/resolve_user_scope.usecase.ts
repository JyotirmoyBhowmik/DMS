import type { TokenScopeClaims } from '@dms/pkg-tenant-scope';
import { buildDefaultScopeClaims } from '@dms/pkg-tenant-scope';
import type { UserScopeRepository } from '../../domain/repositories/user_scope.repository.js';

export class ResolveUserScopeUseCase {
  constructor(private readonly repo: UserScopeRepository) {}

  async execute(tenantId: string, userKey: string, roles: string[]): Promise<TokenScopeClaims> {
    const stored = await this.repo.findByUser(tenantId, userKey);
    if (stored) {
      return stored;
    }
    return buildDefaultScopeClaims(roles);
  }
}
