-- Migration V023: Add StockTransfer constraints, indexes, RLS policies, and optimistic locking version column

ALTER TABLE IF EXISTS stock_transfers
  ADD COLUMN IF NOT EXISTS transfer_number VARCHAR(255) NOT NULL DEFAULT 'TRF-DEFAULT',
  ADD COLUMN IF NOT EXISTS source_warehouse_id VARCHAR(255) NOT NULL DEFAULT 'wh-source',
  ADD COLUMN IF NOT EXISTS target_warehouse_id VARCHAR(255) NOT NULL DEFAULT 'wh-target',
  ADD COLUMN IF NOT EXISTS sku_id VARCHAR(255) NOT NULL DEFAULT 'sku-default',
  ADD COLUMN IF NOT EXISTS quantity INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'REQUESTED',
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Constraint enforcing distinct source and target warehouses
ALTER TABLE IF EXISTS stock_transfers
  DROP CONSTRAINT IF EXISTS chk_stock_transfers_different_warehouses;
ALTER TABLE IF EXISTS stock_transfers
  ADD CONSTRAINT chk_stock_transfers_different_warehouses CHECK (source_warehouse_id <> target_warehouse_id);

-- Indexes for performance and common filters
CREATE INDEX IF NOT EXISTS idx_stock_transfers_tenant_status ON stock_transfers (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_source_target ON stock_transfers (tenant_id, source_warehouse_id, target_warehouse_id);

-- Row-Level Security Policy
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stock_transfers_tenant_isolation_policy ON stock_transfers;
CREATE POLICY stock_transfers_tenant_isolation_policy ON stock_transfers
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));
