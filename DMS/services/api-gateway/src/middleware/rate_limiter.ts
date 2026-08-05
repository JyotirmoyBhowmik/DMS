/**
 * Token-bucket rate limiter middleware with per-tenant quotas.
 *
 * Each tenant is assigned a bucket that refills at a configured rate.
 * When a request arrives, a token is consumed.  If the bucket is empty
 * the request is rejected with HTTP 429.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RateLimitConfig {
  /** Maximum tokens in a bucket (burst capacity). Default: 100 */
  maxTokens?: number;
  /** Tokens added per second (sustained rate). Default: 10 */
  refillRate?: number;
  /** Per-tenant overrides, keyed by tenant ID */
  tenantOverrides?: Record<string, { maxTokens: number; refillRate: number }>;
  /** Header name carrying the tenant ID. Default: "x-tenant-id" */
  tenantHeader?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  retryAfterMs?: number;
}

interface TokenBucket {
  tokens: number;
  maxTokens: number;
  refillRate: number;
  lastRefill: number;
}

export interface IncomingRequest {
  headers: Record<string, string | undefined>;
  method?: string;
  path?: string;
}

// ─── Rate Limiter ─────────────────────────────────────────────────────────────

export class RateLimiter {
  private readonly buckets = new Map<string, TokenBucket>();
  private readonly defaultMaxTokens: number;
  private readonly defaultRefillRate: number;
  private readonly tenantOverrides: Record<
    string,
    { maxTokens: number; refillRate: number }
  >;
  private readonly tenantHeader: string;

  constructor(config: RateLimitConfig = {}) {
    this.defaultMaxTokens = config.maxTokens ?? 100;
    this.defaultRefillRate = config.refillRate ?? 10;
    this.tenantOverrides = config.tenantOverrides ?? {};
    this.tenantHeader = config.tenantHeader ?? 'x-tenant-id';
  }

  /**
   * Evaluate whether a request should be allowed.
   * Returns rate-limit metadata suitable for setting response headers.
   */
  check(request: IncomingRequest): RateLimitResult {
    const tenantId =
      request.headers[this.tenantHeader] ?? '__anonymous__';

    const bucket = this.getOrCreateBucket(tenantId);
    this.refill(bucket);

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return {
        allowed: true,
        remaining: Math.floor(bucket.tokens),
        limit: bucket.maxTokens,
      };
    }

    // Bucket is empty → compute when the next token will be available
    const retryAfterMs = Math.ceil((1 / bucket.refillRate) * 1000);

    return {
      allowed: false,
      remaining: 0,
      limit: bucket.maxTokens,
      retryAfterMs,
    };
  }

  /**
   * Middleware-style handler.
   * Returns headers to set on the response, plus the decision.
   */
  middleware(request: IncomingRequest): {
    result: RateLimitResult;
    headers: Record<string, string>;
  } {
    const result = this.check(request);
    const headers: Record<string, string> = {
      'X-RateLimit-Limit': String(result.limit),
      'X-RateLimit-Remaining': String(result.remaining),
    };

    if (!result.allowed && result.retryAfterMs) {
      headers['Retry-After'] = String(Math.ceil(result.retryAfterMs / 1000));
    }

    return { result, headers };
  }

  /**
   * Reset a tenant's bucket (e.g. after quota change or admin override).
   */
  resetBucket(tenantId: string): void {
    this.buckets.delete(tenantId);
  }

  /**
   * Flush all buckets.
   */
  resetAll(): void {
    this.buckets.clear();
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private getOrCreateBucket(tenantId: string): TokenBucket {
    let bucket = this.buckets.get(tenantId);
    if (!bucket) {
      const override = this.tenantOverrides[tenantId];
      bucket = {
        tokens: override?.maxTokens ?? this.defaultMaxTokens,
        maxTokens: override?.maxTokens ?? this.defaultMaxTokens,
        refillRate: override?.refillRate ?? this.defaultRefillRate,
        lastRefill: Date.now(),
      };
      this.buckets.set(tenantId, bucket);
    }
    return bucket;
  }

  private refill(bucket: TokenBucket): void {
    const now = Date.now();
    const elapsed = (now - bucket.lastRefill) / 1000; // seconds
    const newTokens = elapsed * bucket.refillRate;

    bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + newTokens);
    bucket.lastRefill = now;
  }
}
