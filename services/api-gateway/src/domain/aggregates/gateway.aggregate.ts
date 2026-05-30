import { ApiKey } from '../entities/api_key.js';
import { RateLimitEntry } from '../entities/rate_limit_entry.js';
import {
  AuthenticationRequiredError,
  ApiKeyExpiredError,
  InsufficientPermissionsError,
  RateLimitExceededError,
} from '../errors/gateway.errors.js';

/**
 * GatewayAggregate encapsulates core gateway domain logic:
 * - API key validation (active, not expired, has required permissions)
 * - Rate limit enforcement
 */
export class GatewayAggregate {
  /**
   * Validates an API key against the required permissions for a route.
   * @throws AuthenticationRequiredError if the key is not active
   * @throws ApiKeyExpiredError if the key has expired
   * @throws InsufficientPermissionsError if the key lacks required permissions
   */
  validateApiKey(apiKey: ApiKey, requiredPermissions: string[]): void {
    if (!apiKey.isActive) {
      throw new AuthenticationRequiredError('API key has been revoked');
    }

    if (apiKey.isExpired()) {
      throw new ApiKeyExpiredError(apiKey.id);
    }

    if (requiredPermissions.length > 0) {
      const missingPermissions = requiredPermissions.filter(
        (perm) => !apiKey.hasPermission(perm),
      );
      if (missingPermissions.length > 0) {
        throw new InsufficientPermissionsError(missingPermissions);
      }
    }
  }

  /**
   * Validates JWT claims against the required permissions for a route.
   * @throws InsufficientPermissionsError if the JWT lacks required permissions
   */
  validateJwtPermissions(
    jwtPermissions: string[],
    requiredPermissions: string[],
  ): void {
    if (requiredPermissions.length === 0) {
      return;
    }

    const hasWildcard = jwtPermissions.includes('*');
    if (hasWildcard) {
      return;
    }

    const missingPermissions = requiredPermissions.filter(
      (perm) => !jwtPermissions.includes(perm),
    );
    if (missingPermissions.length > 0) {
      throw new InsufficientPermissionsError(missingPermissions);
    }
  }

  /**
   * Enforces rate limiting by checking if the entry has exceeded its limit.
   * @throws RateLimitExceededError if the rate limit has been exceeded
   */
  enforceRateLimit(entry: RateLimitEntry, limit: number): void {
    if (entry.isExceeded(limit)) {
      const retryAfterMs = entry.remainingWindowMs();
      throw new RateLimitExceededError(retryAfterMs);
    }
  }
}
