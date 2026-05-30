/**
 * RateLimitEntry tracks the request count for a specific client/endpoint
 * within a sliding time window.
 */
export class RateLimitEntry {
  readonly key: string;
  readonly windowStart: number;
  readonly requestCount: number;
  readonly windowSize: number;

  constructor(props: {
    key: string;
    windowStart: number;
    requestCount: number;
    windowSize: number;
  }) {
    this.key = props.key;
    this.windowStart = props.windowStart;
    this.requestCount = props.requestCount;
    this.windowSize = props.windowSize;
  }

  /**
   * Creates a new RateLimitEntry for a fresh window.
   */
  static create(key: string, windowSizeMs: number): RateLimitEntry {
    return new RateLimitEntry({
      key,
      windowStart: Date.now(),
      requestCount: 1,
      windowSize: windowSizeMs,
    });
  }

  /**
   * Checks whether the current time falls within this entry's window.
   */
  isWithinWindow(now?: number): boolean {
    const currentTime = now ?? Date.now();
    return currentTime - this.windowStart < this.windowSize;
  }

  /**
   * Returns a new RateLimitEntry with the request count incremented.
   * If the window has expired, resets to a new window with count 1.
   */
  increment(now?: number): RateLimitEntry {
    const currentTime = now ?? Date.now();
    if (!this.isWithinWindow(currentTime)) {
      return new RateLimitEntry({
        key: this.key,
        windowStart: currentTime,
        requestCount: 1,
        windowSize: this.windowSize,
      });
    }
    return new RateLimitEntry({
      key: this.key,
      windowStart: this.windowStart,
      requestCount: this.requestCount + 1,
      windowSize: this.windowSize,
    });
  }

  /**
   * Returns a new RateLimitEntry with the window reset.
   */
  reset(): RateLimitEntry {
    return RateLimitEntry.create(this.key, this.windowSize);
  }

  /**
   * Checks whether the request count has exceeded the given limit.
   */
  isExceeded(limit: number): boolean {
    return this.requestCount > limit;
  }

  /**
   * Calculates the number of milliseconds remaining in the current window.
   */
  remainingWindowMs(now?: number): number {
    const currentTime = now ?? Date.now();
    const remaining = this.windowSize - (currentTime - this.windowStart);
    return Math.max(0, remaining);
  }
}
