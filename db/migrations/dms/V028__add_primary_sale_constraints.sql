-- Migration V028: Add PrimarySale constraints, indexes, RLS policies, and optimistic locking version column

ALTER TABLE IF EXISTS primary_sales
  ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(255) NOT NULL DEFAULT 'INV-DEFAULT',
  ADD COLUMN IF NOT EXISTS distributor_id VARCHAR(255) NOT NULL DEFAULT 'dist-default',
  ADD COLUMN IF NOT EXISTS warehouse_id VARCHAR(255) NOT NULL DEFAULT 'wh-default',
  ADD COLUMN IF NOT EXISTS sku_id VARCHAR(255) NOT NULL DEFAULT 'sku-default',
  ADD COLUMN IF NOT EXISTS quantity INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS unit_price_cents BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount_cents BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Constraints enforcing non-negative prices and positive quantity
ALTER TABLE IF EXISTS primary_sales
  DROP CONSTRAINT IF EXISTS chk_primary_sales_positive_quantity;
ALTER TABLE IF EXISTS primary_sales
  ADD CONSTRAINT chk_primary_sales_positive_quantity CHECK (quantity > 0);

ALTER TABLE IF EXISTS primary_sales
  DROP CONSTRAINT IF EXISTS chk_primary_sales_non_negative_amounts;
ALTER TABLE IF EXISTS primary_sales
  ADD CONSTRAINT chk_primary_sales_non_negative_amounts CHECK (unit_price_cents >= 0 AND total_amount_cents >= 0);

-- Indexes for performance and common filters
CREATE INDEX IF NOT EXISTS idx_primary_sales_tenant_status ON primary_sales (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_primary_sales_dist_wh ON primary_sales (tenant_id, distributor_id, warehouse_id);

-- Row-Level Security Policy
ALTER TABLE primary_sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS primary_sales_tenant_isolation_policy ON primary_sales;
CREATE POLICY primary_sales_tenant_isolation_policy ON primary_sales
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));
