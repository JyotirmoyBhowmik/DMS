-- Migration V032: Add PriceSlab constraints, indexes, RLS policies, and optimistic locking version column

CREATE TABLE IF NOT EXISTS price_slabs (
  id VARCHAR(255) PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,
  price_list_id VARCHAR(255) NOT NULL,
  sku_id VARCHAR(255) NOT NULL,
  min_quantity INT NOT NULL DEFAULT 1,
  max_quantity INT NOT NULL DEFAULT 999999,
  price_cents BIGINT NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Constraints enforcing non-negative prices and valid quantity range
ALTER TABLE IF EXISTS price_slabs
  DROP CONSTRAINT IF EXISTS chk_price_slabs_positive_quantity_range;
ALTER TABLE IF EXISTS price_slabs
  ADD CONSTRAINT chk_price_slabs_positive_quantity_range CHECK (min_quantity > 0 AND max_quantity >= min_quantity);

ALTER TABLE IF EXISTS price_slabs
  DROP CONSTRAINT IF EXISTS chk_price_slabs_non_negative_price;
ALTER TABLE IF EXISTS price_slabs
  ADD CONSTRAINT chk_price_slabs_non_negative_price CHECK (price_cents >= 0);

-- Indexes for performance and common filters
CREATE INDEX IF NOT EXISTS idx_price_slabs_tenant_list ON price_slabs (tenant_id, price_list_id);
CREATE INDEX IF NOT EXISTS idx_price_slabs_tenant_sku ON price_slabs (tenant_id, sku_id);

-- Row-Level Security Policy
ALTER TABLE price_slabs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS price_slabs_tenant_isolation_policy ON price_slabs;
CREATE POLICY price_slabs_tenant_isolation_policy ON price_slabs
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));
