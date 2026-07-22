-- Migration V031: Add PriceList constraints, indexes, RLS policies, and optimistic locking version column

CREATE TABLE IF NOT EXISTS price_lists (
  id VARCHAR(255) PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(255) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_price_lists_code UNIQUE (tenant_id, code)
);

-- Indexes for performance and common filters
CREATE INDEX IF NOT EXISTS idx_price_lists_tenant_status ON price_lists (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_price_lists_tenant_code ON price_lists (tenant_id, code);

-- Row-Level Security Policy
ALTER TABLE price_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS price_lists_tenant_isolation_policy ON price_lists;
CREATE POLICY price_lists_tenant_isolation_policy ON price_lists
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));
