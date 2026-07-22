-- Migration V035: Add Discount constraints, indexes, RLS policies, and optimistic locking version column

CREATE TABLE IF NOT EXISTS discounts (
  id VARCHAR(255) PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(255) NOT NULL,
  discount_type VARCHAR(50) NOT NULL DEFAULT 'PERCENTAGE',
  value NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  min_order_amount_cents BIGINT NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_discounts_code UNIQUE (tenant_id, code)
);

-- Constraints enforcing positive discount values
ALTER TABLE IF EXISTS discounts
  DROP CONSTRAINT IF EXISTS chk_discounts_positive_value;
ALTER TABLE IF EXISTS discounts
  ADD CONSTRAINT chk_discounts_positive_value CHECK (value > 0);

-- Indexes for performance and common filters
CREATE INDEX IF NOT EXISTS idx_discounts_tenant_status ON discounts (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_discounts_tenant_code ON discounts (tenant_id, code);

-- Row-Level Security Policy
ALTER TABLE discounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS discounts_tenant_isolation_policy ON discounts;
CREATE POLICY discounts_tenant_isolation_policy ON discounts
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));
