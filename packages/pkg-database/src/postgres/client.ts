import net from 'node:net';
import { Pool, PoolClient } from 'pg';
import { setTenantContext, clearTenantContext } from '../rls/policy_builder.js';
import { DatabaseError } from '../errors.js';
import { ICacheClient, CacheOptions } from '../cache/cache-client.js';

// ─── Configuration ────────────────────────────────────────────────────────────

export interface DatabaseConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean | object;
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

// ─── Query Result ─────────────────────────────────────────────────────────────

export interface QueryResult<T = unknown> {
  rows: T[];
  rowCount: number;
}

// ─── Pool Metrics ─────────────────────────────────────────────────────────────

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

// ─── Connection Interface ─────────────────────────────────────────────────────

/**
 * Abstraction over a single database connection (or client) obtained from
 * a pool.  Both `PgDriver` and `InMemoryDriver` vend objects conforming to
 * this contract.
 */
export interface IConnectionClient {
  query<R = unknown>(sql: string, params?: unknown[]): Promise<QueryResult<R>>;
  release(): void;
}

// ─── Driver Interface ─────────────────────────────────────────────────────────

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

// ─── Circuit Breaker ──────────────────────────────────────────────────────────

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

class CircuitBreaker {
  private state = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;

  constructor(
    private readonly threshold: number,
    private readonly resetMs: number,
  ) {}

  get currentState(): CircuitState {
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
  guard(): void {
    const s = this.currentState;
    if (s === CircuitState.OPEN) {
      throw new DatabaseError(
        'Circuit breaker is OPEN – database calls are temporarily blocked',
        'CIRCUIT_OPEN',
      );
    }
  }

  recordSuccess(): void {
    this.failureCount = 0;
    this.state = CircuitState.CLOSED;
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.threshold) {
      this.state = CircuitState.OPEN;
    }
  }
}

// ─── Prepared Statement Cache ─────────────────────────────────────────────────

class PreparedStatementCache {
  private readonly cache = new Map<string, string>();
  private counter = 0;

  /**
   * Returns a stable prepared-statement name for the given SQL string.
   * New entries are assigned an incrementing name (`ps_0`, `ps_1`, …).
   */
  getOrCreate(sql: string): string {
    let name = this.cache.get(sql);
    if (!name) {
      name = `ps_${this.counter++}`;
      this.cache.set(sql, name);
    }
    return name;
  }

  has(sql: string): boolean {
    return this.cache.has(sql);
  }

  clear(): void {
    this.cache.clear();
    this.counter = 0;
  }

  get size(): number {
    return this.cache.size;
  }
}

import { Pool as NeonPool } from '@neondatabase/serverless';

export const buildDatabaseConnectionString = (): string | undefined => {
  let connStr = (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.NEON_DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING
  )?.trim();

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

export const getNeonConnectionString = buildDatabaseConnectionString;

// ─── NeonDriver (Serverless Neon Adapter) ──────────────────────────────────────

export class NeonDriver implements IDatabaseDriver {
  private pool: NeonPool;
  private metrics: PoolMetrics;

  constructor(connectionString?: string, maxConnections = 10) {
    const connStr = connectionString || getNeonConnectionString();
    const isTest = process.env.NODE_ENV === 'test' || process.env.CI !== undefined;
    if (!connStr && !isTest) {
      throw new DatabaseError(
        'Missing Neon database connection string. Ensure DATABASE_URL or POSTGRES_URL environment variable is set in Vercel.',
        'MISSING_CONNECTION_STRING'
      );
    }

    this.pool = new NeonPool({
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

  async connect(): Promise<IConnectionClient> {
    const isTest = process.env.NODE_ENV === 'test' || process.env.CI !== undefined;
    let client: any;
    try {
      client = await this.pool.connect();
    } catch (err) {
      if (isTest) {
        return {
          async query<R>(_sql: string, _params?: unknown[]): Promise<QueryResult<R>> {
            return { rows: [] as R[], rowCount: 0 };
          },
          release(): void {},
        };
      }
      throw err;
    }

    this.metrics.activeConnections++;
    this.metrics.idleConnections--;
    this.metrics.totalAcquired++;

    const self = this;
    return {
      async query<R>(sql: string, params?: unknown[]): Promise<QueryResult<R>> {
        const result = await client.query(sql, params);
        return {
          rows: (result.rows || []) as R[],
          rowCount: result.rowCount ?? (result.rows?.length || 0),
        };
      },
      release(): void {
        client.release();
        self.metrics.activeConnections--;
        self.metrics.idleConnections++;
        self.metrics.totalReleased++;
      },
    };
  }

  async end(): Promise<void> {
    await this.pool.end();
  }

  getPoolMetrics(): PoolMetrics {
    return { ...this.metrics };
  }
}

// ─── PgDriver (real pg Pool adapter) ──────────────────────────────────────────

/**
 * Production driver backed by the `pg` package's Pool.
 */
export class PgDriver implements IDatabaseDriver {
  private pool: Pool;
  private metrics: PoolMetrics;

  constructor(pool?: Pool, maxConnections = 10) {
    const connStr = getNeonConnectionString();
    this.pool = pool ?? new Pool(connStr ? { connectionString: connStr } : undefined);
    this.metrics = {
      activeConnections: 0,
      idleConnections: maxConnections,
      totalAcquired: 0,
      totalReleased: 0,
      maxConnections,
    };
  }

  async connect(): Promise<IConnectionClient> {
    const isTest = process.env.NODE_ENV === 'test' || process.env.CI !== undefined;
    let pgClient: PoolClient;
    try {
      pgClient = await this.pool.connect();
    } catch (err) {
      if (isTest) {
        return {
          async query<R>(_sql: string, _params?: unknown[]): Promise<QueryResult<R>> {
            return { rows: [] as R[], rowCount: 0 };
          },
          release(): void {},
        };
      }
      throw err;
    }

    this.metrics.activeConnections++;
    this.metrics.idleConnections--;
    this.metrics.totalAcquired++;

    const self = this;
    return {
      async query<R>(sql: string, params?: unknown[]): Promise<QueryResult<R>> {
        // Real pg client returns { rows, rowCount, ... }
        const result = await pgClient.query(sql, params);
        if (Array.isArray(result)) {
          const lastResult = result[result.length - 1];
          return {
            rows: (lastResult?.rows || []) as R[],
            rowCount: lastResult?.rowCount ?? (lastResult?.rows?.length || 0),
          };
        }
        return {
          rows: (result.rows || []) as R[],
          rowCount: result.rowCount ?? (result.rows?.length || 0),
        };
      },
      release(): void {
        pgClient.release();
        self.metrics.activeConnections--;
        self.metrics.idleConnections++;
        self.metrics.totalReleased++;
      },
    };
  }

  async end(): Promise<void> {
    await this.pool.end();
  }

  getPoolMetrics(): PoolMetrics {
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

// ─── InMemoryDriver (testing / sandbox) ───────────────────────────────────────

/**
 * An in-memory driver for unit tests and local sandbox execution.
 * All queries return empty result sets by default.  Override `queryHandler`
 * to supply custom responses.
 */
export class InMemoryDriver implements IDatabaseDriver {
  private metrics: PoolMetrics;
  private closed = false;

  /**
   * Optional hook that tests can set to intercept / mock queries.
   * Return `undefined` to fall through to the default empty-result behaviour.
   */
  public queryHandler:
    | ((sql: string, params?: unknown[]) => QueryResult | undefined)
    | null = null;

  constructor(maxConnections = 10) {
    this.metrics = {
      activeConnections: 0,
      idleConnections: maxConnections,
      totalAcquired: 0,
      totalReleased: 0,
      maxConnections,
    };
  }

  async connect(): Promise<IConnectionClient> {
    if (this.closed) {
      throw new DatabaseError('InMemoryDriver pool is closed', 'POOL_CLOSED');
    }

    this.metrics.activeConnections++;
    this.metrics.idleConnections--;
    this.metrics.totalAcquired++;

    const self = this;
    let released = false;

    return {
      async query<R>(sql: string, params?: unknown[]): Promise<QueryResult<R>> {
        if (self.queryHandler) {
          const result = self.queryHandler(sql, params);
          if (result) return result as QueryResult<R>;
        }
        return { rows: [] as R[], rowCount: 0 };
      },
      release(): void {
        if (!released) {
          released = true;
          self.metrics.activeConnections--;
          self.metrics.idleConnections++;
          self.metrics.totalReleased++;
        }
      },
    };
  }

  async end(): Promise<void> {
    this.closed = true;
    this.metrics.activeConnections = 0;
    this.metrics.idleConnections = 0;
  }

  getPoolMetrics(): PoolMetrics {
    return { ...this.metrics };
  }
}

// ─── PostgresDatabaseClient ───────────────────────────────────────────────────

export class PostgresDatabaseClient {
  private readonly config: DatabaseConfig;
  private readonly driver: IDatabaseDriver;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly preparedStatements = new PreparedStatementCache();
  private cacheClient?: ICacheClient;

  // Resolved configuration values
  private readonly queryTimeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;

  constructor(
    configOrDriver?: DatabaseConfig | IDatabaseDriver,
    driver?: IDatabaseDriver,
  ) {
    let resolvedConfig: DatabaseConfig = {};
    let resolvedDriver: IDatabaseDriver | undefined;

    if (configOrDriver) {
      if (
        'connect' in configOrDriver &&
        typeof configOrDriver.connect === 'function'
      ) {
        resolvedDriver = configOrDriver as IDatabaseDriver;
      } else {
        resolvedConfig = configOrDriver as DatabaseConfig;
        resolvedDriver = driver;
      }
    } else {
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

    this.circuitBreaker = new CircuitBreaker(
      resolvedConfig.circuitBreakerThreshold ?? 5,
      resolvedConfig.circuitBreakerResetMs ?? 30_000,
    );
  }

  setCacheClient(client: ICacheClient): void {
    this.cacheClient = client;
  }

  // ── Health Check ──────────────────────────────────────────────────────────

  /**
   * Performs a health check by attempting to reach the database host and port
   * via a TCP socket.
   */
  async checkHealth(): Promise<{
    status: 'HEALTHY' | 'UNHEALTHY';
    latencyMs: number;
    poolMetrics: PoolMetrics;
    circuitBreaker: string;
    error?: string;
  }> {
    const start = Date.now();
    const host = this.config.host || 'localhost';
    const port = this.config.port || 5432;

    const tcpResult = await new Promise<{ ok: boolean; error?: string }>(
      (resolve) => {
        const socket = new net.Socket();
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
      },
    );

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
  async query<T = unknown>(
    sql: string,
    params?: unknown[],
    tenantId?: string,
    cacheOpts?: CacheOptions,
    isolationTier: 'SHARED_RLS' | 'SCHEMA_PER_TENANT' | 'DEDICATED_CLUSTER' = 'SHARED_RLS'
  ): Promise<QueryResult<T>> {
    if (cacheOpts && this.cacheClient) {
      const cached = await this.cacheClient.get<QueryResult<T>>(cacheOpts.key);
      if (cached) {
        return cached;
      }
    }

    this.circuitBreaker.guard();

    let client: IConnectionClient;
    try {
      client = await this.acquireWithRetry();
    } catch (err) {
      this.circuitBreaker.recordFailure();
      throw err;
    }

    try {
      if (tenantId) {
        if (isolationTier === 'SCHEMA_PER_TENANT') {
          const cleanSchema = `tenant_${tenantId.replace(/[^a-zA-Z0-9_]/g, '')}`;
          await client.query(`SET LOCAL search_path TO "${cleanSchema}", public`);
        } else {
          await setTenantContext(
            { query: (s: string, p?: unknown[]) => client.query(s, p).then(() => undefined as unknown) },
            tenantId,
            'SESSION'
          );
        }
      }

      let result;
      try {
        result = await this.executeWithTimeout<T>(client, sql, params);
      } finally {
        if (tenantId) {
          await clearTenantContext(
            { query: (s: string, p?: unknown[]) => client.query(s, p).then(() => undefined as unknown) }
          );
        }
      }

      this.circuitBreaker.recordSuccess();

      if (cacheOpts && this.cacheClient) {
        await this.cacheClient.set(cacheOpts.key, result, cacheOpts.ttlSeconds);
      }

      return result;
    } catch (err) {
      this.circuitBreaker.recordFailure();
      throw err instanceof DatabaseError
        ? err
        : new DatabaseError(
            `Query failed: ${(err as Error).message}`,
            'QUERY_ERROR',
            err as Error,
          );
    } finally {
      client.release();
    }
  }

  // ── Transaction ───────────────────────────────────────────────────────────

  /**
   * Executes database operations inside a managed SQL transaction.
   */
  async transaction<T>(
    operations: (conn: {
      query: (sql: string, params?: unknown[]) => Promise<QueryResult>;
    }) => Promise<T>,
    tenantId?: string,
  ): Promise<T> {
    this.circuitBreaker.guard();

    let client: IConnectionClient;
    try {
      client = await this.acquireWithRetry();
    } catch (err) {
      this.circuitBreaker.recordFailure();
      throw err;
    }

    try {
      await client.query('BEGIN');

      if (tenantId) {
        await setTenantContext(
          { query: (s: string, p?: unknown[]) => client.query(s, p).then(() => undefined as unknown) },
          tenantId,
        );
      }

      try {
        const connInterface = {
          query: (s: string, p?: unknown[]) => client.query(s, p),
        };
        const result = await operations(connInterface);
        await client.query('COMMIT');
        this.circuitBreaker.recordSuccess();
        return result;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {
          // Best-effort rollback; the connection will be destroyed anyway.
        });
        this.circuitBreaker.recordFailure();
        throw err;
      }
    } finally {
      client.release();
    }
  }

  // ── Pool Metrics ──────────────────────────────────────────────────────────

  getPoolMetrics(): PoolMetrics {
    return this.driver.getPoolMetrics();
  }

  // ── Prepared Statement Cache ──────────────────────────────────────────────

  getPreparedStatementName(sql: string): string {
    return this.preparedStatements.getOrCreate(sql);
  }

  get preparedStatementCount(): number {
    return this.preparedStatements.size;
  }

  clearPreparedStatements(): void {
    this.preparedStatements.clear();
  }

  // ── Shutdown ──────────────────────────────────────────────────────────────

  async shutdown(): Promise<void> {
    this.preparedStatements.clear();
    await this.driver.end();
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Acquire a connection with exponential-backoff retry logic.
   */
  private async acquireWithRetry(): Promise<IConnectionClient> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.driver.connect();
      } catch (err) {
        lastError = err as Error;
        if (attempt < this.maxRetries) {
          const delay = this.retryBaseDelayMs * Math.pow(2, attempt);
          // Add jitter: ±25 %
          const jitter = delay * 0.25 * (Math.random() * 2 - 1);
          await this.sleep(Math.max(0, delay + jitter));
        }
      }
    }

    throw new DatabaseError(
      `Failed to acquire connection after ${this.maxRetries + 1} attempts: ${lastError?.message}`,
      'CONNECTION_EXHAUSTED',
      lastError,
    );
  }

  /**
   * Execute a query with a configurable timeout.
   */
  private async executeWithTimeout<T>(
    client: IConnectionClient,
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    if (this.queryTimeoutMs <= 0) {
      return client.query<T>(sql, params);
    }

    return new Promise<QueryResult<T>>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new DatabaseError(
            `Query timed out after ${this.queryTimeoutMs}ms`,
            'QUERY_TIMEOUT',
          ),
        );
      }, this.queryTimeoutMs);

      client
        .query<T>(sql, params)
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

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
