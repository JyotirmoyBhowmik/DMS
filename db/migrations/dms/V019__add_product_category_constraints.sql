-- Migration V019: Add ProductCategory constraints, indexes, RLS policies, and optimistic locking version column

ALTER TABLE IF EXISTS product_categories
  ADD COLUMN IF NOT EXISTS parent_category_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Unique Category Code constraint per tenant
ALTER TABLE IF EXISTS product_categories
  DROP CONSTRAINT IF EXISTS uq_product_categories_tenant_code;
ALTER TABLE IF EXISTS product_categories
  ADD CONSTRAINT uq_product_categories_tenant_code UNIQUE (tenant_id, code);

-- Indexes for performance and common filters
CREATE INDEX IF NOT EXISTS idx_product_categories_tenant_status ON product_categories (tenant_id, status);

-- Row-Level Security Policy
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_categories_tenant_isolation_policy ON product_categories;
CREATE POLICY product_categories_tenant_isolation_policy ON product_categories
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));
