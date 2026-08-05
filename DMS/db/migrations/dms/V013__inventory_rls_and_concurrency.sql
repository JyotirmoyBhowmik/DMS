-- =============================================================================
-- V013: Enable Row-Level Security (RLS) on batches, stock_ledger, and inventory_records
-- =============================================================================

BEGIN;

-- 1. Batches Table
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_batches ON batches;
CREATE POLICY tenant_isolation_batches ON batches
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

-- 2. Stock Ledger Table
ALTER TABLE stock_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_stock_ledger ON stock_ledger;
CREATE POLICY tenant_isolation_stock_ledger ON stock_ledger
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

-- 3. Inventory Records Table
ALTER TABLE inventory_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_inventory_records ON inventory_records;
CREATE POLICY tenant_isolation_inventory_records ON inventory_records
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

COMMIT;
