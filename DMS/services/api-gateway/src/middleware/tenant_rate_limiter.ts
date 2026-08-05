export interface TenantQuotaConfig {
  maxRequestsPerMinute: number;
}

export class TenantRateLimiter {
  private static tenantBuckets = new Map<string, { count: number; resetAt: number }>();

  private static DEFAULT_TIER_QUOTAS: Record<string, number> = {
    FREE: 60,
    STARTER: 300,
    PROFESSIONAL: 1200,
    ENTERPRISE: 6000,
  };

  /**
   * Enforces tenant-aware rate limits using sliding 1-minute window token buckets.
   */
  static checkRateLimit(
    tenantId: string,
    planTier: string = 'STARTER'
  ): { allowed: boolean; remaining: number; resetInMs: number } {
    const limit = this.DEFAULT_TIER_QUOTAS[planTier.toUpperCase()] || 300;
    const now = Date.now();
    const bucketKey = `tenant:${tenantId}`;

    let bucket = this.tenantBuckets.get(bucketKey);
    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + 60_000 };
      this.tenantBuckets.set(bucketKey, bucket);
    }

    if (bucket.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetInMs: bucket.resetAt - now,
      };
    }

    bucket.count += 1;
    return {
      allowed: true,
      remaining: limit - bucket.count,
      resetInMs: bucket.resetAt - now,
    };
  }
}
