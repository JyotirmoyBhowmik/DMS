/**
 * Lightweight Unit-of-Work abstraction for transactional boundaries.
 *
 * The concrete implementation is provided by the infrastructure layer
 * (e.g. a TypeORM or Knex adapter).  Shared packages and domain code
 * depend only on this interface.
 */
export interface Transaction {
    /**
     * Execute a raw query within the current transaction.
     * @param sql   SQL string, may contain $1, $2, … placeholders.
     * @param params Positional bind parameters.
     */
    query<R = unknown>(sql: string, params?: unknown[]): Promise<R>;
    /**
     * Retrieve a repository / DAO scoped to this transaction.
     * The concrete key and return type are implementation-specific.
     */
    getRepository<T>(token: string | symbol | (new (...args: unknown[]) => T)): T;
}
export interface UnitOfWork {
    /**
     * Open a database transaction, execute `fn`, then commit.
     * On error the transaction is rolled back and the error re-thrown.
     *
     * @param fn  Business logic that runs inside the transaction.
     * @returns   The value returned by `fn`.
     */
    run<T>(fn: (tx: Transaction) => Promise<T>): Promise<T>;
}
/**
 * Reference no-op implementation for testing.  Real adapters live in
 * the infrastructure layer.
 */
export declare class InMemoryUnitOfWork implements UnitOfWork {
    run<T>(fn: (tx: Transaction) => Promise<T>): Promise<T>;
}
//# sourceMappingURL=uow.d.ts.map