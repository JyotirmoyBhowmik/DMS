-- Migration V021: Add Inventory constraints, indexes, RLS policies, and optimistic locking version column

ALTER TABLE IF EXISTS inventory
  ADD COLUMN IF NOT EXISTS warehouse_id VARCHAR(255) NOT NULL DEFAULT 'wh-main',
  ADD COLUMN IF NOT EXISTS sku_id VARCHAR(255) NOT NULL DEFAULT 'sku-default',
  ADD COLUMN IF NOT EXISTS quantity_available INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity_reserved INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reorder_level INT NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'IN_STOCK',
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Unique (warehouse_id, sku_id) constraint per tenant
ALTER TABLE IF EXISTS inventory
  DROP CONSTRAINT IF EXISTS uq_inventory_tenant_warehouse_sku;
ALTER TABLE IF EXISTS inventory
  ADD CONSTRAINT uq_inventory_tenant_warehouse_sku UNIQUE (tenant_id, warehouse_id, sku_id);

-- Indexes for performance and common filters
CREATE INDEX IF NOT EXISTS idx_inventory_tenant_status ON inventory (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse ON inventory (tenant_id, warehouse_id);

-- Row-Level Security Policy
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_tenant_isolation_policy ON inventory;
CREATE POLICY inventory_tenant_isolation_policy ON inventory
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));
