-- Migration V027: Add Replacement constraints, indexes, RLS policies, and optimistic locking version column

ALTER TABLE IF EXISTS replacements
  ADD COLUMN IF NOT EXISTS replacement_number VARCHAR(255) NOT NULL DEFAULT 'REP-DEFAULT',
  ADD COLUMN IF NOT EXISTS return_id VARCHAR(255) NOT NULL DEFAULT 'ret-default',
  ADD COLUMN IF NOT EXISTS outlet_id VARCHAR(255) NOT NULL DEFAULT 'outlet-default',
  ADD COLUMN IF NOT EXISTS warehouse_id VARCHAR(255) NOT NULL DEFAULT 'wh-default',
  ADD COLUMN IF NOT EXISTS sku_id VARCHAR(255) NOT NULL DEFAULT 'sku-default',
  ADD COLUMN IF NOT EXISTS quantity INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'REQUESTED',
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Constraint enforcing positive replacement quantity
ALTER TABLE IF EXISTS replacements
  DROP CONSTRAINT IF EXISTS chk_replacements_positive_quantity;
ALTER TABLE IF EXISTS replacements
  ADD CONSTRAINT chk_replacements_positive_quantity CHECK (quantity > 0);

-- Indexes for performance and common filters
CREATE INDEX IF NOT EXISTS idx_replacements_tenant_status ON replacements (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_replacements_return_outlet ON replacements (tenant_id, return_id, outlet_id);

-- Row-Level Security Policy
ALTER TABLE replacements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS replacements_tenant_isolation_policy ON replacements;
CREATE POLICY replacements_tenant_isolation_policy ON replacements
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));
