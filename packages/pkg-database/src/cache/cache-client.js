"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryCacheClient = void 0;
class StructuredLogger {
    name;
    constructor(name) {
        this.name = name;
    }
    info(msg, meta) { console.log(`[INFO] [${this.name}] ${msg}`, meta ? JSON.stringify(meta) : ''); }
    error(msg, meta) { console.error(`[ERROR] [${this.name}] ${msg}`, meta ? JSON.stringify(meta) : ''); }
    warn(msg, meta) { console.warn(`[WARN] [${this.name}] ${msg}`, meta ? JSON.stringify(meta) : ''); }
}
class InMemoryCacheClient {
    cache = new Map();
    logger = new StructuredLogger('InMemoryCacheClient');
    async get(key) {
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
        return entry.value;
    }
    async set(key, value, ttlSeconds = 60) {
        const expiresAt = Date.now() + ttlSeconds * 1000;
        this.cache.set(key, { value, expiresAt });
        this.logger.info(`Cache set for key: ${key} with TTL ${ttlSeconds}s`);
    }
    async del(key) {
        this.cache.delete(key);
        this.logger.info(`Cache deleted key: ${key}`);
    }
    async clear() {
        this.cache.clear();
        this.logger.info('Cache cleared');
    }
}
exports.InMemoryCacheClient = InMemoryCacheClient;
//# sourceMappingURL=cache-client.js.map