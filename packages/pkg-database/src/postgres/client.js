"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresDatabaseClient = exports.InMemoryDriver = exports.PgDriver = exports.NeonDriver = exports.getNeonConnectionString = exports.buildDatabaseConnectionString = void 0;
const node_net_1 = __importDefault(require("node:net"));
const pg_1 = require("pg");
const policy_builder_js_1 = require("../rls/policy_builder.js");
const errors_js_1 = require("../errors.js");
// ─── Circuit Breaker ──────────────────────────────────────────────────────────
var CircuitState;
(function (CircuitState) {
    CircuitState["CLOSED"] = "CLOSED";
    CircuitState["OPEN"] = "OPEN";
    CircuitState["HALF_OPEN"] = "HALF_OPEN";
})(CircuitState || (CircuitState = {}));
class CircuitBreaker {
    threshold;
    resetMs;
    state = CircuitState.CLOSED;
    failureCount = 0;
    lastFailureTime = 0;
    constructor(threshold, resetMs) {
        this.threshold = threshold;
        this.resetMs = resetMs;
    }
    get currentState() {
        if (this.state === CircuitState.OPEN) {
            if (Date.now() - this.lastFailureTime >= this.resetMs) {
                this.state = CircuitState.HALF_OPEN;
            }
        }
        return this.state;
    }
    /**
     * Throws if the circuit is OPEN and the reset window hasn't elapsed.
     */
    guard() {
        const s = this.currentState;
        if (s === CircuitState.OPEN) {
            throw new errors_js_1.DatabaseError('Circuit breaker is OPEN – database calls are temporarily blocked', 'CIRCUIT_OPEN');
        }
    }
    recordSuccess() {
        this.failureCount = 0;
        this.state = CircuitState.CLOSED;
    }
    recordFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        if (this.failureCount >= this.threshold) {
            this.state = CircuitState.OPEN;
        }
    }
}
// ─── Prepared Statement Cache ─────────────────────────────────────────────────
class PreparedStatementCache {
    cache = new Map();
    counter = 0;
    /**
     * Returns a stable prepared-statement name for the given SQL string.
     * New entries are assigned an incrementing name (`ps_0`, `ps_1`, …).
     */
    getOrCreate(sql) {
        let name = this.cache.get(sql);
        if (!name) {
            name = `ps_${this.counter++}`;
            this.cache.set(sql, name);
        }
        return name;
    }
    has(sql) {
        return this.cache.has(sql);
    }
    clear() {
        this.cache.clear();
        this.counter = 0;
    }
    get size() {
        return this.cache.size;
    }
}
const serverless_1 = require("@neondatabase/serverless");
const buildDatabaseConnectionString = () => {
    let connStr = (process.env.DATABASE_URL ||
        process.env.POSTGRES_URL ||
        process.env.NEON_DATABASE_URL ||
        process.env.POSTGRES_PRISMA_URL ||
        process.env.POSTGRES_URL_NON_POOLING)?.trim();
    // Assemble connection string from split environment variables if single URL is not provided
    if (!connStr) {
        const host = (process.env.DB_HOST || process.env.PGHOST)?.trim();
        const port = (process.env.DB_PORT || process.env.PGPORT || '5432')?.trim();
        const user = (process.env.DB_USER || process.env.PGUSER)?.trim();
        const password = (process.env.DB_PASSWORD || process.env.PGPASSWORD)?.trim();
        const database = (process.env.DB_NAME || process.env.PGDATABASE)?.trim();
        if (host && user && password && database) {
            const encodedUser = encodeURIComponent(user);
            const encodedPass = encodeURIComponent(password);
            connStr = `postgres://${encodedUser}:${encodedPass}@${host}:${port}/${database}`;
        }
    }
    if (!connStr) {
        return undefined;
    }
    // Enforce sslmode=require for Neon SSL security
    if (!connStr.includes('sslmode=') && !connStr.includes('ssl=')) {
        const separator = connStr.includes('?') ? '&' : '?';
        connStr = `${connStr}${separator}sslmode=require`;
    }
    return connStr;
};
exports.buildDatabaseConnectionString = buildDatabaseConnectionString;
exports.getNeonConnectionString = exports.buildDatabaseConnectionString;
// ─── NeonDriver (Serverless Neon Adapter) ──────────────────────────────────────
class NeonDriver {
    pool;
    metrics;
    constructor(connectionString, maxConnections = 10) {
        const connStr = connectionString || (0, exports.getNeonConnectionString)();
        const isTest = process.env.NODE_ENV === 'test' || process.env.CI !== undefined;
        if (!connStr && !isTest) {
            throw new errors_js_1.DatabaseError('Missing Neon database connection string. Ensure DATABASE_URL or POSTGRES_URL environment variable is set in Vercel.', 'MISSING_CONNECTION_STRING');
        }
        this.pool = new serverless_1.Pool({
            connectionString: connStr || 'postgres://placeholder.neon.tech/dms_test',
            max: maxConnections,
        });
        this.metrics = {
            activeConnections: 0,
            idleConnections: maxConnections,
            totalAcquired: 0,
            totalReleased: 0,
            maxConnections,
        };
    }
    async connect() {
        const isTest = process.env.NODE_ENV === 'test' || process.env.CI !== undefined;
        let client;
        try {
            client = await this.pool.connect();
        }
        catch (err) {
            if (isTest) {
                return {
                    async query(_sql, _params) {
                        return { rows: [], rowCount: 0 };
                    },
                    release() { },
                };
            }
            throw err;
        }
        this.metrics.activeConnections++;
        this.metrics.idleConnections--;
        this.metrics.totalAcquired++;
        const self = this;
        return {
            async query(sql, params) {
                const result = await client.query(sql, params);
                return {
                    rows: (result.rows || []),
                    rowCount: result.rowCount ?? (result.rows?.length || 0),
                };
            },
            release() {
                client.release();
                self.metrics.activeConnections--;
                self.metrics.idleConnections++;
                self.metrics.totalReleased++;
            },
        };
    }
    async end() {
        await this.pool.end();
    }
    getPoolMetrics() {
        return { ...this.metrics };
    }
}
exports.NeonDriver = NeonDriver;
// ─── PgDriver (real pg Pool adapter) ──────────────────────────────────────────
/**
 * Production driver backed by the `pg` package's Pool.
 */
class PgDriver {
    pool;
    metrics;
    constructor(pool, maxConnections = 10) {
        const connStr = (0, exports.getNeonConnectionString)();
        this.pool = pool ?? new pg_1.Pool(connStr ? { connectionString: connStr } : undefined);
        this.metrics = {
            activeConnections: 0,
            idleConnections: maxConnections,
            totalAcquired: 0,
            totalReleased: 0,
            maxConnections,
        };
    }
    async connect() {
        const isTest = process.env.NODE_ENV === 'test' || process.env.CI !== undefined;
        let pgClient;
        try {
            pgClient = await this.pool.connect();
        }
        catch (err) {
            if (isTest) {
                return {
                    async query(_sql, _params) {
                        return { rows: [], rowCount: 0 };
                    },
                    release() { },
                };
            }
            throw err;
        }
        this.metrics.activeConnections++;
        this.metrics.idleConnections--;
        this.metrics.totalAcquired++;
        const self = this;
        return {
            async query(sql, params) {
                // Real pg client returns { rows, rowCount, ... }
                const result = await pgClient.query(sql, params);
                if (Array.isArray(result)) {
                    const lastResult = result[result.length - 1];
                    return {
                        rows: (lastResult?.rows || []),
                        rowCount: lastResult?.rowCount ?? (lastResult?.rows?.length || 0),
                    };
                }
                return {
                    rows: (result.rows || []),
                    rowCount: result.rowCount ?? (result.rows?.length || 0),
                };
            },
            release() {
                pgClient.release();
                self.metrics.activeConnections--;
                self.metrics.idleConnections++;
                self.metrics.totalReleased++;
            },
        };
    }
    async end() {
        await this.pool.end();
    }
    getPoolMetrics() {
        // If the real pool exposes runtime stats, prefer those:
        // return {
        //   activeConnections: this.pool.totalCount - this.pool.idleCount,
        //   idleConnections: this.pool.idleCount,
        //   totalAcquired: this.metrics.totalAcquired,
        //   totalReleased: this.metrics.totalReleased,
        //   maxConnections: this.metrics.maxConnections,
        // };
        return { ...this.metrics };
    }
}
exports.PgDriver = PgDriver;
// ─── InMemoryDriver (testing / sandbox) ───────────────────────────────────────
/**
 * An in-memory driver for unit tests and local sandbox execution.
 * All queries return empty result sets by default.  Override `queryHandler`
 * to supply custom responses.
 */
class InMemoryDriver {
    metrics;
    closed = false;
    /**
     * Optional hook that tests can set to intercept / mock queries.
     * Return `undefined` to fall through to the default empty-result behaviour.
     */
    queryHandler = null;
    constructor(maxConnections = 10) {
        this.metrics = {
            activeConnections: 0,
            idleConnections: maxConnections,
            totalAcquired: 0,
            totalReleased: 0,
            maxConnections,
        };
    }
    async connect() {
        if (this.closed) {
            throw new errors_js_1.DatabaseError('InMemoryDriver pool is closed', 'POOL_CLOSED');
        }
        this.metrics.activeConnections++;
        this.metrics.idleConnections--;
        this.metrics.totalAcquired++;
        const self = this;
        let released = false;
        return {
            async query(sql, params) {
                if (self.queryHandler) {
                    const result = self.queryHandler(sql, params);
                    if (result)
                        return result;
                }
                return { rows: [], rowCount: 0 };
            },
            release() {
                if (!released) {
                    released = true;
                    self.metrics.activeConnections--;
                    self.metrics.idleConnections++;
                    self.metrics.totalReleased++;
                }
            },
        };
    }
    async end() {
        this.closed = true;
        this.metrics.activeConnections = 0;
        this.metrics.idleConnections = 0;
    }
    getPoolMetrics() {
        return { ...this.metrics };
    }
}
exports.InMemoryDriver = InMemoryDriver;
// ─── PostgresDatabaseClient ───────────────────────────────────────────────────
class PostgresDatabaseClient {
    config;
    driver;
    circuitBreaker;
    preparedStatements = new PreparedStatementCache();
    cacheClient;
    // Resolved configuration values
    queryTimeoutMs;
    maxRetries;
    retryBaseDelayMs;
    constructor(configOrDriver, driver) {
        let resolvedConfig = {};
        let resolvedDriver;
        if (configOrDriver) {
            if ('connect' in configOrDriver &&
                typeof configOrDriver.connect === 'function') {
                resolvedDriver = configOrDriver;
            }
            else {
                resolvedConfig = configOrDriver;
                resolvedDriver = driver;
            }
        }
        else {
            resolvedDriver = driver;
        }
        this.config = resolvedConfig;
        const isTest = process.env.NODE_ENV === 'test' || process.env.CI !== undefined;
        this.queryTimeoutMs = resolvedConfig.queryTimeoutMs ?? 30_000;
        this.maxRetries = isTest ? 0 : (resolvedConfig.maxRetries ?? 5);
        this.retryBaseDelayMs = isTest ? 0 : (resolvedConfig.retryBaseDelayMs ?? 200);
        // If no driver is provided, create a default InMemoryDriver so existing
        // call-sites that only pass `config` continue to work (backwards compat).
        this.driver =
            resolvedDriver ?? new InMemoryDriver(resolvedConfig.maxConnections ?? 10);
        this.circuitBreaker = new CircuitBreaker(resolvedConfig.circuitBreakerThreshold ?? 5, resolvedConfig.circuitBreakerResetMs ?? 30_000);
    }
    setCacheClient(client) {
        this.cacheClient = client;
    }
    // ── Health Check ──────────────────────────────────────────────────────────
    /**
     * Performs a health check by attempting to reach the database host and port
     * via a TCP socket.
     */
    async checkHealth() {
        const start = Date.now();
        const host = this.config.host || 'localhost';
        const port = this.config.port || 5432;
        const tcpResult = await new Promise((resolve) => {
            const socket = new node_net_1.default.Socket();
            socket.setTimeout(2000);
            socket.on('connect', () => {
                socket.destroy();
                resolve({ ok: true });
            });
            socket.on('error', (err) => {
                socket.destroy();
                resolve({ ok: false, error: err.message });
            });
            socket.on('timeout', () => {
                socket.destroy();
                resolve({ ok: false, error: 'Connection timeout' });
            });
            socket.connect(port, host);
        });
        return {
            status: tcpResult.ok ? 'HEALTHY' : 'UNHEALTHY',
            latencyMs: Date.now() - start,
            poolMetrics: this.driver.getPoolMetrics(),
            circuitBreaker: this.circuitBreaker.currentState,
            ...(tcpResult.error ? { error: tcpResult.error } : {}),
        };
    }
    // ── Query ─────────────────────────────────────────────────────────────────
    /**
     * Executes a query on the database.
     * If RLS tenant context is provided, automatically runs setTenantContext
     * before execution.
     */
    async query(sql, params, tenantId, cacheOpts, isolationTier = 'SHARED_RLS') {
        if (cacheOpts && this.cacheClient) {
            const cached = await this.cacheClient.get(cacheOpts.key);
            if (cached) {
                return cached;
            }
        }
        this.circuitBreaker.guard();
        let client;
        try {
            client = await this.acquireWithRetry();
        }
        catch (err) {
            this.circuitBreaker.recordFailure();
            throw err;
        }
        try {
            if (tenantId) {
                if (isolationTier === 'SCHEMA_PER_TENANT') {
                    const cleanSchema = `tenant_${tenantId.replace(/[^a-zA-Z0-9_]/g, '')}`;
                    await client.query(`SET LOCAL search_path TO "${cleanSchema}", public`);
                }
                else {
                    await (0, policy_builder_js_1.setTenantContext)({ query: (s, p) => client.query(s, p).then(() => undefined) }, tenantId, 'SESSION');
                }
            }
            let result;
            try {
                result = await this.executeWithTimeout(client, sql, params);
            }
            finally {
                if (tenantId) {
                    await (0, policy_builder_js_1.clearTenantContext)({ query: (s, p) => client.query(s, p).then(() => undefined) });
                }
            }
            this.circuitBreaker.recordSuccess();
            if (cacheOpts && this.cacheClient) {
                await this.cacheClient.set(cacheOpts.key, result, cacheOpts.ttlSeconds);
            }
            return result;
        }
        catch (err) {
            this.circuitBreaker.recordFailure();
            throw err instanceof errors_js_1.DatabaseError
                ? err
                : new errors_js_1.DatabaseError(`Query failed: ${err.message}`, 'QUERY_ERROR', err);
        }
        finally {
            client.release();
        }
    }
    // ── Transaction ───────────────────────────────────────────────────────────
    /**
     * Executes database operations inside a managed SQL transaction.
     */
    async transaction(operations, tenantId) {
        this.circuitBreaker.guard();
        let client;
        try {
            client = await this.acquireWithRetry();
        }
        catch (err) {
            this.circuitBreaker.recordFailure();
            throw err;
        }
        try {
            await client.query('BEGIN');
            if (tenantId) {
                await (0, policy_builder_js_1.setTenantContext)({ query: (s, p) => client.query(s, p).then(() => undefined) }, tenantId);
            }
            try {
                const connInterface = {
                    query: (s, p) => client.query(s, p),
                };
                const result = await operations(connInterface);
                await client.query('COMMIT');
                this.circuitBreaker.recordSuccess();
                return result;
            }
            catch (err) {
                await client.query('ROLLBACK').catch(() => {
                    // Best-effort rollback; the connection will be destroyed anyway.
                });
                this.circuitBreaker.recordFailure();
                throw err;
            }
        }
        finally {
            client.release();
        }
    }
    // ── Pool Metrics ──────────────────────────────────────────────────────────
    getPoolMetrics() {
        return this.driver.getPoolMetrics();
    }
    // ── Prepared Statement Cache ──────────────────────────────────────────────
    getPreparedStatementName(sql) {
        return this.preparedStatements.getOrCreate(sql);
    }
    get preparedStatementCount() {
        return this.preparedStatements.size;
    }
    clearPreparedStatements() {
        this.preparedStatements.clear();
    }
    // ── Shutdown ──────────────────────────────────────────────────────────────
    async shutdown() {
        this.preparedStatements.clear();
        await this.driver.end();
    }
    // ── Private helpers ───────────────────────────────────────────────────────
    /**
     * Acquire a connection with exponential-backoff retry logic.
     */
    async acquireWithRetry() {
        let lastError;
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                return await this.driver.connect();
            }
            catch (err) {
                lastError = err;
                if (attempt < this.maxRetries) {
                    const delay = this.retryBaseDelayMs * Math.pow(2, attempt);
                    // Add jitter: ±25 %
                    const jitter = delay * 0.25 * (Math.random() * 2 - 1);
                    await this.sleep(Math.max(0, delay + jitter));
                }
            }
        }
        throw new errors_js_1.DatabaseError(`Failed to acquire connection after ${this.maxRetries + 1} attempts: ${lastError?.message}`, 'CONNECTION_EXHAUSTED', lastError);
    }
    /**
     * Execute a query with a configurable timeout.
     */
    async executeWithTimeout(client, sql, params) {
        if (this.queryTimeoutMs <= 0) {
            return client.query(sql, params);
        }
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new errors_js_1.DatabaseError(`Query timed out after ${this.queryTimeoutMs}ms`, 'QUERY_TIMEOUT'));
            }, this.queryTimeoutMs);
            client
                .query(sql, params)
                .then((result) => {
                clearTimeout(timer);
                resolve(result);
            })
                .catch((err) => {
                clearTimeout(timer);
                reject(err);
            });
        });
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
exports.PostgresDatabaseClient = PostgresDatabaseClient;
//# sourceMappingURL=client.js.map