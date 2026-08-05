import type { TokenScopeClaims } from '@dms/pkg-tenant-scope';
import type { UserScopeRepository } from '../../domain/repositories/user_scope.repository.js';

export class InMemoryUserScopeRepository implements UserScopeRepository {
  private static store = new Map<string, TokenScopeClaims>();

  static clearAll(): void {
    this.store.clear();
  }

  private key(tenantId: string, userKey: string): string {
    return `${tenantId}:${userKey.toLowerCase()}`;
  }

  async findByUser(tenantId: string, userKey: string): Promise<TokenScopeClaims | null> {
    return InMemoryUserScopeRepository.store.get(this.key(tenantId, userKey)) ?? null;
  }

  async upsert(tenantId: string, userKey: string, scope: TokenScopeClaims): Promise<TokenScopeClaims> {
    InMemoryUserScopeRepository.store.set(this.key(tenantId, userKey), scope);
    return scope;
  }

  async delete(tenantId: string, userKey: string): Promise<void> {
    InMemoryUserScopeRepository.store.delete(this.key(tenantId, userKey));
  }
}
