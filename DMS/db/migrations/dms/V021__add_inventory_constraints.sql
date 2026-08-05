-- Migration V021: Add Inventory constraints, indexes, RLS policies, and optimistic locking version column

CREATE TABLE IF NOT EXISTS inventory_records (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID          NOT NULL,
  product_id      UUID          NOT NULL,
  warehouse_id    VARCHAR(100)  NOT NULL,
  stock           INTEGER       NOT NULL DEFAULT 0 CHECK (stock >= 0),
  version         INTEGER       NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS inventory_records
  ADD COLUMN IF NOT EXISTS warehouse_id VARCHAR(255) NOT NULL DEFAULT 'wh-main',
  ADD COLUMN IF NOT EXISTS sku_id VARCHAR(255) NOT NULL DEFAULT 'sku-default',
  ADD COLUMN IF NOT EXISTS quantity_available INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity_reserved INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reorder_level INT NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'IN_STOCK',
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Indexes for performance and common filters
CREATE INDEX IF NOT EXISTS idx_inventory_tenant_status ON inventory_records (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse ON inventory_records (tenant_id, warehouse_id);

-- Row-Level Security Policy
ALTER TABLE inventory_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_tenant_isolation_policy ON inventory_records;
CREATE POLICY inventory_tenant_isolation_policy ON inventory_records
  FOR ALL
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
