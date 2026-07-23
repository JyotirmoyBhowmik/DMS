-- Migration V038: Add SchemePromotion constraints, indexes, RLS policies, and optimistic locking version column

CREATE TABLE IF NOT EXISTS scheme_promotions (
  id VARCHAR(255) PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,
  scheme_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  promo_code VARCHAR(255) NOT NULL,
  promotion_type VARCHAR(50) NOT NULL DEFAULT 'PERCENTAGE_DISCOUNT',
  discount_percentage NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  max_discount_cents BIGINT NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_scheme_promotions_code UNIQUE (tenant_id, promo_code)
);

-- Constraints enforcing valid percentage range
ALTER TABLE IF EXISTS scheme_promotions
  DROP CONSTRAINT IF EXISTS chk_scheme_promotions_valid_percentage;
ALTER TABLE IF EXISTS scheme_promotions
  ADD CONSTRAINT chk_scheme_promotions_valid_percentage CHECK (discount_percentage >= 0 AND discount_percentage <= 100);

-- Indexes for performance and common filters
CREATE INDEX IF NOT EXISTS idx_scheme_promotions_tenant_status ON scheme_promotions (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_scheme_promotions_tenant_scheme ON scheme_promotions (tenant_id, scheme_id);

-- Row-Level Security Policy
ALTER TABLE scheme_promotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scheme_promotions_tenant_isolation_policy ON scheme_promotions;
CREATE POLICY scheme_promotions_tenant_isolation_policy ON scheme_promotions
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));
