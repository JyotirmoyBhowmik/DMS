/**
 * Generates the SQL statements required to enable Row-Level Security
 * on a table and create a tenant isolation policy that uses
 * `current_setting('app.tenant_id')` as the session-level discriminator.
 */
export function buildTenantRlsPolicy(table: string, tenantColumn: string): string {
  const safeName = sanitizeIdentifier(table);
  const safeCol = sanitizeIdentifier(tenantColumn);
  const policyName = `tenant_isolation_${safeName}`;

  return [
    `ALTER TABLE "${safeName}" ENABLE ROW LEVEL SECURITY;`,
    '',
    `CREATE POLICY "${policyName}" ON "${safeName}"`,
    `  FOR ALL`,
    `  USING ("${safeCol}" = current_setting('app.tenant_id')::uuid)`,
    `  WITH CHECK ("${safeCol}" = current_setting('app.tenant_id')::uuid);`,
  ].join('\n');
}

/**
 * Sets the tenant context on a database connection for the duration
 * of the current transaction.  Must be called inside a transaction
 * before issuing any tenant-scoped queries.
 */
export async function setTenantContext(
  conn: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
  tenantId: string,
): Promise<void> {
  // Use SET LOCAL so the setting only lives for the current transaction.
  await conn.query(`SET LOCAL app.tenant_id = '${sanitizeLiteral(tenantId)}'`);
}

/**
 * Clears the tenant context on a database connection.
 * Typically called at the end of a transaction or on connection release.
 */
export async function clearTenantContext(
  conn: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
): Promise<void> {
  await conn.query(`RESET app.tenant_id`);
}

// ── Helpers ────────────────────────────────────────────────────

function sanitizeIdentifier(name: string): string {
  // Strip anything that isn't alphanumeric or underscore to prevent SQL injection
  return name.replace(/[^a-zA-Z0-9_]/g, '');
}

function sanitizeLiteral(value: string): string {
  // Escape single quotes and strip semicolons
  return value.replace(/'/g, "''").replace(/;/g, '');
}

// ── Backward-compatible class API ──────────────────────────────

export class RlsPolicyBuilder {
  static generateRlsEnableSql(tableName: string): string {
    const safe = sanitizeIdentifier(tableName);
    return `ALTER TABLE "${safe}" ENABLE ROW LEVEL SECURITY;`;
  }

  static generateTenantIsolationPolicySql(tableName: string, tenantColumn = 'tenant_id'): string {
    return buildTenantRlsPolicy(tableName, tenantColumn);
  }
}
