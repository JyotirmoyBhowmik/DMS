-- Migration V033: Add GeoPriceRule constraints, indexes, RLS policies, and optimistic locking version column

CREATE TABLE IF NOT EXISTS geo_price_rules (
  id VARCHAR(255) PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,
  price_list_id VARCHAR(255) NOT NULL,
  region_code VARCHAR(100) NOT NULL,
  multiplier NUMERIC(5,2) NOT NULL DEFAULT 1.00,
  price_adjustment_cents BIGINT NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_geo_price_rules_region UNIQUE (tenant_id, price_list_id, region_code)
);

-- Constraints enforcing positive multiplier
ALTER TABLE IF EXISTS geo_price_rules
  DROP CONSTRAINT IF EXISTS chk_geo_price_rules_positive_multiplier;
ALTER TABLE IF EXISTS geo_price_rules
  ADD CONSTRAINT chk_geo_price_rules_positive_multiplier CHECK (multiplier > 0);

-- Indexes for performance and common filters
CREATE INDEX IF NOT EXISTS idx_geo_price_rules_tenant_region ON geo_price_rules (tenant_id, region_code);
CREATE INDEX IF NOT EXISTS idx_geo_price_rules_tenant_list ON geo_price_rules (tenant_id, price_list_id);

-- Row-Level Security Policy
ALTER TABLE geo_price_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS geo_price_rules_tenant_isolation_policy ON geo_price_rules;
CREATE POLICY geo_price_rules_tenant_isolation_policy ON geo_price_rules
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));
