-- =============================================================================
-- Row Level Security (RLS) Tenant Isolation Policies
-- Defines PostgreSQL policies that dynamically enforce tenant separation
-- using the session variable: `app.tenant_id`.
-- =============================================================================

-- 1. Enable RLS on all tables
ALTER TABLE distributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE products_skus ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE retail_outlets ENABLE ROW LEVEL SECURITY;

-- 2. Define Tenant Isolation Policies (Postgres 15+)
-- Enforces that all SELECT, INSERT, UPDATE, DELETE query rows match the active session context.

CREATE POLICY tenant_isolation_distributors ON distributors
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_isolation_products_skus ON products_skus
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_isolation_inventory_records ON inventory_records
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_isolation_retail_outlets ON retail_outlets
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

-- 3. Apply on SFA service tables (orders, visits, journey_plans)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE journey_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_orders ON orders
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_isolation_visits ON visits
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_isolation_journey_plans ON journey_plans
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

-- 4. Apply on System service tables
ALTER TABLE client_sync_queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_conflict_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE tamper_evident_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_sync_queues ON client_sync_queues
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_isolation_conflict_records ON sync_conflict_records
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_isolation_audit_log ON tamper_evident_audit_log
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
