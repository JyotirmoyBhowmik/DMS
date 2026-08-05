import { RateLimitEntry } from '../../domain/entities/index.js';

/**
 * Port interface for rate limit tracking operations.
 */
export interface IRateLimitStore {
  /** Retrieves the current rate limit entry for the given key. */
  get(key: string): Promise<RateLimitEntry | null>;

  /** Increments the request counter for the given key within a sliding window. */
  increment(key: string, windowSizeMs: number): Promise<RateLimitEntry>;

  /** Resets the rate limit entry for the given key. */
  reset(key: string): Promise<void>;

  /** Removes entries older than the specified threshold. Returns count of cleaned entries. */
  cleanup(olderThanMs: number): Promise<number>;
}
