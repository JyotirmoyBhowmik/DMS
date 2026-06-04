export interface DatabaseConfig {
    connectionString?: string;
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
    maxConnections?: number;
    idleTimeoutMillis?: number;
    /** Default query timeout in milliseconds. Default: 30_000 */
    queryTimeoutMs?: number;
    /** Maximum connection retries with exponential backoff. Default: 5 */
    maxRetries?: number;
    /** Base delay in ms for exponential backoff. Default: 200 */
    retryBaseDelayMs?: number;
    /** Circuit breaker: failure threshold before opening. Default: 5 */
    circuitBreakerThreshold?: number;
    /** Circuit breaker: time in ms before attempting half-open. Default: 30_000 */
    circuitBreakerResetMs?: number;
}
export interface QueryResult<T = unknown> {
    rows: T[];
    rowCount: number;
}
export interface PoolMetrics {
    /** Number of connections currently executing a query */
    activeConnections: number;
    /** Number of connections sitting idle in the pool */
    idleConnections: number;
    /** Total number of times a connection was acquired from the pool */
    totalAcquired: number;
    /** Total number of times a connection was released back to the pool */
    totalReleased: number;
    /** Maximum pool size */
    maxConnections: number;
}
/**
 * Abstraction over a single database connection (or client) obtained from
 * a pool.  Both `PgDriver` and `InMemoryDriver` vend objects conforming to
 * this contract.
 */
export interface IConnectionClient {
    query<R = unknown>(sql: string, params?: unknown[]): Promise<QueryResult<R>>;
    release(): void;
}
/**
 * Abstracts the actual database driver (pg, in-memory, etc.) so that the
 * `PostgresDatabaseClient` is not coupled to any concrete driver package.
 */
export interface IDatabaseDriver {
    /**
     * Acquire a connection from the underlying pool.
     * The caller MUST call `release()` on the returned client when done.
     */
    connect(): Promise<IConnectionClient>;
    /**
     * Gracefully shut down the pool, closing all connections.
     */
    end(): Promise<void>;
    /**
     * Return current pool metrics.
     */
    getPoolMetrics(): PoolMetrics;
}
/**
 * Production driver backed by the `pg` package's Pool.
 *
 * Usage (when `pg` is installed):
 * ```ts
 * import { Pool } from 'pg';
 * const pool = new Pool({ connectionString: '...' });
 * const driver = new PgDriver(pool);
 * const client = new PostgresDatabaseClient(config, driver);
 * ```
 */
export declare class PgDriver implements IDatabaseDriver {
    private pool;
    private metrics;
    /**
     * @param pool  A `pg.Pool` instance (or any object with the same API).
     * @param maxConnections  The `max` value the pool was created with (for metrics).
     */
    constructor(pool: any, maxConnections?: number);
    connect(): Promise<IConnectionClient>;
    end(): Promise<void>;
    getPoolMetrics(): PoolMetrics;
}
/**
 * An in-memory driver for unit tests and local sandbox execution.
 * All queries return empty result sets by default.  Override `queryHandler`
 * to supply custom responses.
 */
export declare class InMemoryDriver implements IDatabaseDriver {
    private metrics;
    private closed;
    /**
     * Optional hook that tests can set to intercept / mock queries.
     * Return `undefined` to fall through to the default empty-result behaviour.
     */
    queryHandler: ((sql: string, params?: unknown[]) => QueryResult | undefined) | null;
    constructor(maxConnections?: number);
    connect(): Promise<IConnectionClient>;
    end(): Promise<void>;
    getPoolMetrics(): PoolMetrics;
}
export declare class PostgresDatabaseClient {
    private readonly config;
    private readonly driver;
    private readonly circuitBreaker;
    private readonly preparedStatements;
    private readonly queryTimeoutMs;
    private readonly maxRetries;
    private readonly retryBaseDelayMs;
    constructor(config: DatabaseConfig, driver?: IDatabaseDriver);
    /**
     * Performs a health check by attempting to reach the database host and port
     * via a TCP socket.
     */
    checkHealth(): Promise<{
        status: 'HEALTHY' | 'UNHEALTHY';
        latencyMs: number;
        poolMetrics: PoolMetrics;
        circuitBreaker: string;
        error?: string;
    }>;
    /**
     * Executes a query on the database.
     * If RLS tenant context is provided, automatically runs setTenantContext
     * before execution.
     */
    query<T = unknown>(sql: string, params?: unknown[], tenantId?: string): Promise<QueryResult<T>>;
    /**
     * Executes database operations inside a managed SQL transaction.
     */
    transaction<T>(operations: (conn: {
        query: (sql: string, params?: unknown[]) => Promise<QueryResult>;
    }) => Promise<T>, tenantId?: string): Promise<T>;
    getPoolMetrics(): PoolMetrics;
    getPreparedStatementName(sql: string): string;
    get preparedStatementCount(): number;
    clearPreparedStatements(): void;
    shutdown(): Promise<void>;
    /**
     * Acquire a connection with exponential-backoff retry logic.
     */
    private acquireWithRetry;
    /**
     * Execute a query with a configurable timeout.
     */
    private executeWithTimeout;
    private sleep;
}
//# sourceMappingURL=client.d.ts.map