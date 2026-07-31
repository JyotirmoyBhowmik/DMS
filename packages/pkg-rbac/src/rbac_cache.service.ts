import { Principal, RbacGuard } from './index.js';

export interface CacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
}

export class InMemoryCacheClient implements CacheClient {
  private store = new Map<string, { value: string; expiresAt: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds: number = 300): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }
}

export class RbacCacheService {
  private cache: CacheClient;
  private ttlSeconds: number;
  private userPermissionsMap = new Map<string, string[]>();

  constructor(cacheClientOrTtl?: CacheClient | number, ttlSeconds: number = 300) {
    if (typeof cacheClientOrTtl === 'number') {
      this.ttlSeconds = Math.floor(cacheClientOrTtl / 1000);
      this.cache = new InMemoryCacheClient();
    } else {
      this.cache = cacheClientOrTtl ?? new InMemoryCacheClient();
      this.ttlSeconds = ttlSeconds;
    }
  }

  setPermissions(userId: string, permissions: string[]): void {
    this.userPermissionsMap.set(userId, permissions);
  }

  getPermissions(userId: string): string[] | null {
    return this.userPermissionsMap.get(userId) ?? null;
  }

  hasPermission(userId: string, permission: string): boolean {
    const permissions = this.getPermissions(userId);
    if (!permissions) return false;
    if (permissions.includes('*')) return true;
    if (permissions.includes(permission)) return true;
    const scope = permission.split(':')[0];
    return !!scope && permissions.includes(`${scope}:*`);
  }

  invalidate(userId: string): void {
    this.userPermissionsMap.delete(userId);
  }

  private buildKey(principalId: string, tenantId: string, permission: string): string {
    return `rbac:perm:${tenantId}:${principalId}:${permission}`;
  }

  async can(principal: Principal, requiredPermission: string): Promise<boolean> {
    const key = this.buildKey(principal.id, principal.tenantId, requiredPermission);
    const cached = await this.cache.get(key);

    if (cached !== null) {
      return cached === 'true';
    }

    const allowed = RbacGuard.can(principal, requiredPermission);
    await this.cache.set(key, allowed ? 'true' : 'false', this.ttlSeconds);
    return allowed;
  }

  async invalidateUserPermissions(principalId: string, tenantId: string): Promise<void> {
    this.invalidate(principalId);
    const prefix = `rbac:perm:${tenantId}:${principalId}:`;
    if (this.cache instanceof InMemoryCacheClient) {
      const keys = Array.from(((this.cache as unknown) as { store: Map<string, unknown> }).store.keys());
      for (const k of keys) {
        if (k.startsWith(prefix)) {
          await this.cache.del(k);
        }
      }
    }
  }
}
