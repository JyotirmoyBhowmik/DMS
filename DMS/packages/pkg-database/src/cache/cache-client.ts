class StructuredLogger {
  constructor(private name: string) {}
  info(msg: string, meta?: any) { console.log(`[INFO] [${this.name}] ${msg}`, meta ? JSON.stringify(meta) : ''); }
  error(msg: string, meta?: any) { console.error(`[ERROR] [${this.name}] ${msg}`, meta ? JSON.stringify(meta) : ''); }
  warn(msg: string, meta?: any) { console.warn(`[WARN] [${this.name}] ${msg}`, meta ? JSON.stringify(meta) : ''); }
}

export interface CacheOptions {
  key: string;
  ttlSeconds?: number;
}

export interface ICacheClient {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  clear(): Promise<void>;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class InMemoryCacheClient implements ICacheClient {
  private cache = new Map<string, CacheEntry<any>>();
  private logger = new StructuredLogger('InMemoryCacheClient');

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.logger.info(`Cache expired for key: ${key}`);
      this.cache.delete(key);
      return null;
    }

    this.logger.info(`Cache hit for key: ${key}`);
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds = 60): Promise<void> {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.cache.set(key, { value, expiresAt });
    this.logger.info(`Cache set for key: ${key} with TTL ${ttlSeconds}s`);
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
    this.logger.info(`Cache deleted key: ${key}`);
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.logger.info('Cache cleared');
  }
}
