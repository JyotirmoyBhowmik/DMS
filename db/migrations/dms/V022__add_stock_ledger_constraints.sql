-- Migration V022: Add StockLedger constraints, indexes, RLS policies, and optimistic locking version column

ALTER TABLE IF EXISTS stock_ledger
  ADD COLUMN IF NOT EXISTS warehouse_id VARCHAR(255) NOT NULL DEFAULT 'wh-main',
  ADD COLUMN IF NOT EXISTS sku_id VARCHAR(255) NOT NULL DEFAULT 'sku-default',
  ADD COLUMN IF NOT EXISTS batch_number VARCHAR(255) NOT NULL DEFAULT 'DEFAULT-BATCH',
  ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(50) NOT NULL DEFAULT 'ADJUSTMENT',
  ADD COLUMN IF NOT EXISTS quantity INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS running_balance INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reference_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Indexes for performance, chronological queries, and common filters
CREATE INDEX IF NOT EXISTS idx_stock_ledger_tenant_created ON stock_ledger (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_warehouse_sku ON stock_ledger (tenant_id, warehouse_id, sku_id);

-- Row-Level Security Policy
ALTER TABLE stock_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stock_ledger_tenant_isolation_policy ON stock_ledger;
CREATE POLICY stock_ledger_tenant_isolation_policy ON stock_ledger
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));
