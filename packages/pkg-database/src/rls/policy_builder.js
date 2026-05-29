"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RlsPolicyBuilder = void 0;
class RlsPolicyBuilder {
    static generateRlsEnableSql(tableName) {
        return `ALTER TABLE "${tableName}" ENABLE ROW LEVEL SECURITY;`;
    }
    static generateTenantIsolationPolicySql(tableName, tenantColumn = 'tenant_id') {
        const policyName = `tenant_isolation_${tableName}`;
        return `
CREATE POLICY "${policyName}" ON "${tableName}"
  FOR ALL
  USING ("${tenantColumn}" = current_setting('app.current_tenant_id', true))
  WITH CHECK ("${tenantColumn}" = current_setting('app.current_tenant_id', true));
`.trim();
    }
}
exports.RlsPolicyBuilder = RlsPolicyBuilder;
//# sourceMappingURL=policy_builder.js.map