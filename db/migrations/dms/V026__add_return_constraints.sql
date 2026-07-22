-- Migration V026: Add Return / SalesReturn constraints, indexes, RLS policies, and optimistic locking version column

ALTER TABLE IF EXISTS returns
  ADD COLUMN IF NOT EXISTS return_number VARCHAR(255) NOT NULL DEFAULT 'RET-DEFAULT',
  ADD COLUMN IF NOT EXISTS outlet_id VARCHAR(255) NOT NULL DEFAULT 'outlet-default',
  ADD COLUMN IF NOT EXISTS warehouse_id VARCHAR(255) NOT NULL DEFAULT 'wh-default',
  ADD COLUMN IF NOT EXISTS sku_id VARCHAR(255) NOT NULL DEFAULT 'sku-default',
  ADD COLUMN IF NOT EXISTS quantity INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS reason VARCHAR(255) NOT NULL DEFAULT 'DEFECTIVE',
  ADD COLUMN IF NOT EXISTS total_amount_cents BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'REQUESTED',
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Constraint enforcing positive return quantity
ALTER TABLE IF EXISTS returns
  DROP CONSTRAINT IF EXISTS chk_returns_positive_quantity;
ALTER TABLE IF EXISTS returns
  ADD CONSTRAINT chk_returns_positive_quantity CHECK (quantity > 0);

-- Indexes for performance and common filters
CREATE INDEX IF NOT EXISTS idx_returns_tenant_status ON returns (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_returns_outlet_wh ON returns (tenant_id, outlet_id, warehouse_id);

-- Row-Level Security Policy
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS returns_tenant_isolation_policy ON returns;
CREATE POLICY returns_tenant_isolation_policy ON returns
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));
