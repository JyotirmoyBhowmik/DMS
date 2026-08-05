import type { TokenScopeClaims } from '@dms/pkg-tenant-scope';

export interface UserScopeRepository {
  findByUser(tenantId: string, userKey: string): Promise<TokenScopeClaims | null>;
  upsert(tenantId: string, userKey: string, scope: TokenScopeClaims): Promise<TokenScopeClaims>;
  delete(tenantId: string, userKey: string): Promise<void>;
}
