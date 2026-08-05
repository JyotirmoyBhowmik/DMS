/**
 * Sliding window rate limiter.
 * Tracks requests per tenant per model within a configurable window.
 */
interface RateLimitWindow {
  windowStart: number;
  requestCount: number;
}

export class SlidingWindowRateLimiter {
  private buckets = new Map<string, RateLimitWindow>();
  private readonly windowSizeMs: number;

  constructor(windowSizeMs: number = 60_000) {
    this.windowSizeMs = windowSizeMs;
  }

  private makeKey(tenantId: string, modelId: string): string {
    return `${tenantId}:${modelId}`;
  }

  /**
   * Returns true if the request is allowed, false if rate limit exceeded.
   * Also increments the counter if allowed.
   */
  tryAcquire(tenantId: string, modelId: string, limit: number): boolean {
    const key = this.makeKey(tenantId, modelId);
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || now - bucket.windowStart >= this.windowSizeMs) {
      this.buckets.set(key, { windowStart: now, requestCount: 1 });
      return true;
    }

    if (bucket.requestCount >= limit) {
      return false;
    }

    bucket.requestCount++;
    return true;
  }

  /**
   * Returns remaining requests in the current window.
   */
  remaining(tenantId: string, modelId: string, limit: number): number {
    const key = this.makeKey(tenantId, modelId);
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || now - bucket.windowStart >= this.windowSizeMs) {
      return limit;
    }

    return Math.max(0, limit - bucket.requestCount);
  }

  /**
   * Milliseconds until the current window resets.
   */
  retryAfterMs(tenantId: string, modelId: string): number {
    const key = this.makeKey(tenantId, modelId);
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket) return 0;

    const elapsed = now - bucket.windowStart;
    return Math.max(0, this.windowSizeMs - elapsed);
  }

  reset(tenantId: string, modelId: string): void {
    const key = this.makeKey(tenantId, modelId);
    this.buckets.delete(key);
  }
}
