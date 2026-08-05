import type { RateLimitConfig } from './route.js';

/**
 * ApiKey entity representing an API key issued to a tenant for gateway access.
 * API keys are hashed before storage; the raw key is only available at creation time.
 */
export class ApiKey {
  readonly id: string;
  readonly tenantId: string;
  readonly keyHash: string;
  readonly name: string;
  readonly permissions: string[];
  readonly rateLimit: RateLimitConfig;
  readonly expiresAt: Date | null;
  readonly isActive: boolean;
  readonly lastUsedAt: Date | null;
  readonly createdBy: string;
  readonly createdAt: Date;

  private constructor(props: {
    id: string;
    tenantId: string;
    keyHash: string;
    name: string;
    permissions: string[];
    rateLimit: RateLimitConfig;
    expiresAt: Date | null;
    isActive: boolean;
    lastUsedAt: Date | null;
    createdBy: string;
    createdAt: Date;
  }) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.keyHash = props.keyHash;
    this.name = props.name;
    this.permissions = Object.freeze([...props.permissions]) as string[];
    this.rateLimit = Object.freeze({ ...props.rateLimit });
    this.expiresAt = props.expiresAt;
    this.isActive = props.isActive;
    this.lastUsedAt = props.lastUsedAt;
    this.createdBy = props.createdBy;
    this.createdAt = props.createdAt;
  }

  /**
   * Factory method to create a new ApiKey entity.
   */
  static create(props: {
    id?: string;
    tenantId: string;
    keyHash: string;
    name: string;
    permissions?: string[];
    rateLimit?: Partial<RateLimitConfig>;
    expiresAt?: Date | null;
    createdBy: string;
  }): ApiKey {
    return new ApiKey({
      id: props.id ?? crypto.randomUUID(),
      tenantId: props.tenantId,
      keyHash: props.keyHash,
      name: props.name,
      permissions: props.permissions ?? [],
      rateLimit: {
        requestsPerMinute: props.rateLimit?.requestsPerMinute ?? 60,
        burstSize: props.rateLimit?.burstSize ?? 10,
      },
      expiresAt: props.expiresAt ?? null,
      isActive: true,
      lastUsedAt: null,
      createdBy: props.createdBy,
      createdAt: new Date(),
    });
  }

  /**
   * Returns a new ApiKey that has been revoked (deactivated).
   */
  revoke(): ApiKey {
    return new ApiKey({
      ...this.toPlain(),
      isActive: false,
    });
  }

  /**
   * Returns a new ApiKey with a rotated key hash (new hash, same metadata).
   */
  rotate(newKeyHash: string): ApiKey {
    return new ApiKey({
      ...this.toPlain(),
      keyHash: newKeyHash,
    });
  }

  /**
   * Returns a new ApiKey with the lastUsedAt timestamp updated.
   */
  markUsed(): ApiKey {
    return new ApiKey({
      ...this.toPlain(),
      lastUsedAt: new Date(),
    });
  }

  /**
   * Checks whether this API key has expired.
   */
  isExpired(): boolean {
    if (this.expiresAt === null) {
      return false;
    }
    return new Date() > this.expiresAt;
  }

  /**
   * Checks whether this API key has a specific permission.
   * Supports wildcard '*' which grants all permissions.
   */
  hasPermission(permission: string): boolean {
    if (this.permissions.includes('*')) {
      return true;
    }
    return this.permissions.includes(permission);
  }

  private toPlain() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      keyHash: this.keyHash,
      name: this.name,
      permissions: [...this.permissions],
      rateLimit: { ...this.rateLimit },
      expiresAt: this.expiresAt,
      isActive: this.isActive,
      lastUsedAt: this.lastUsedAt,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
    };
  }
}
