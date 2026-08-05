-- =============================================================================
-- V047: Systematically enforce Row-Level Security (RLS) across all tables
-- Ensures multi-tenant isolation policy on every domain table using app.tenant_id
-- =============================================================================

BEGIN;

-- Helper function to safely apply RLS and create isolation policy
CREATE OR REPLACE FUNCTION apply_tenant_rls(target_table text, tenant_column text DEFAULT 'tenant_id')
RETURNS void AS $$
DECLARE
  policy_name text := 'tenant_isolation_' || target_table;
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', target_table);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', policy_name, target_table);
  EXECUTE format(
    'CREATE POLICY %I ON %I FOR ALL USING (%I = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (%I = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid);',
    policy_name, target_table, tenant_column, tenant_column
  );
END;
$$ LANGUAGE plpgsql;

-- Audit and enforce RLS across core tables
SELECT apply_tenant_rls('tenants', 'id');
SELECT apply_tenant_rls('users');
SELECT apply_tenant_rls('distributors');
SELECT apply_tenant_rls('distributor_hierarchy');
SELECT apply_tenant_rls('products');
SELECT apply_tenant_rls('skus');
SELECT apply_tenant_rls('product_categories');
SELECT apply_tenant_rls('inventories');
SELECT apply_tenant_rls('stock_ledgers');
SELECT apply_tenant_rls('stock_transfers');
SELECT apply_tenant_rls('primary_sales');
SELECT apply_tenant_rls('secondary_sales');
SELECT apply_tenant_rls('tertiary_sales');
SELECT apply_tenant_rls('purchase_orders');
SELECT apply_tenant_rls('returns');
SELECT apply_tenant_rls('replacements');
SELECT apply_tenant_rls('outlet_profiles');
SELECT apply_tenant_rls('outlet_census');
SELECT apply_tenant_rls('kyc_documents');
SELECT apply_tenant_rls('feature_flags');
SELECT apply_tenant_rls('config_entries');

COMMIT;
