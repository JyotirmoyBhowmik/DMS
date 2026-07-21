-- Migration V018: Add Product constraints, indexes, RLS policies, and optimistic locking version column

ALTER TABLE IF EXISTS products
  ADD COLUMN IF NOT EXISTS uom VARCHAR(30) NOT NULL DEFAULT 'UNIT',
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Unique SKU constraint per tenant
ALTER TABLE IF EXISTS products
  DROP CONSTRAINT IF EXISTS uq_products_tenant_sku;
ALTER TABLE IF EXISTS products
  ADD CONSTRAINT uq_products_tenant_sku UNIQUE (tenant_id, sku);

-- Indexes for performance and common filters
CREATE INDEX IF NOT EXISTS idx_products_tenant_status ON products (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_products_category ON products (tenant_id, category);

-- Row-Level Security Policy
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS products_tenant_isolation_policy ON products;
CREATE POLICY products_tenant_isolation_policy ON products
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));
