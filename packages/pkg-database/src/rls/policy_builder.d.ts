/**
 * Generates the SQL statements required to enable Row-Level Security
 * on a table and create a tenant isolation policy that uses
 * `current_setting('app.tenant_id')` as the session-level discriminator.
 */
export declare function buildTenantRlsPolicy(table: string, tenantColumn: string): string;
/**
 * Sets the tenant context on a database connection for the duration
 * of the current transaction.  Must be called inside a transaction
 * before issuing any tenant-scoped queries.
 */
export declare function setTenantContext(conn: {
    query: (sql: string, params?: unknown[]) => Promise<unknown>;
}, tenantId: string): Promise<void>;
/**
 * Clears the tenant context on a database connection.
 * Typically called at the end of a transaction or on connection release.
 */
export declare function clearTenantContext(conn: {
    query: (sql: string, params?: unknown[]) => Promise<unknown>;
}): Promise<void>;
export declare class RlsPolicyBuilder {
    static generateRlsEnableSql(tableName: string): string;
    static generateTenantIsolationPolicySql(tableName: string, tenantColumn?: string): string;
}
//# sourceMappingURL=policy_builder.d.ts.map