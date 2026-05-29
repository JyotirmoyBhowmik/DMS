export class RlsPolicyBuilder {
  static generateRlsEnableSql(tableName: string): string {
    return `ALTER TABLE "${tableName}" ENABLE ROW LEVEL SECURITY;`;
  }

  static generateTenantIsolationPolicySql(tableName: string, tenantColumn = 'tenant_id'): string {
    const policyName = `tenant_isolation_${tableName}`;
    return `
CREATE POLICY "${policyName}" ON "${tableName}"
  FOR ALL
  USING ("${tenantColumn}" = current_setting('app.current_tenant_id', true))
  WITH CHECK ("${tenantColumn}" = current_setting('app.current_tenant_id', true));
`.trim();
  }
}
