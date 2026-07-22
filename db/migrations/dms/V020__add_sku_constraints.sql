-- Migration V020: Add SKU constraints, indexes, RLS policies, and optimistic locking version column

ALTER TABLE IF EXISTS skus
  ADD COLUMN IF NOT EXISTS barcode VARCHAR(100),
  ADD COLUMN IF NOT EXISTS ean VARCHAR(100),
  ADD COLUMN IF NOT EXISTS unit_price INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Unique SKU Code constraint per tenant
ALTER TABLE IF EXISTS skus
  DROP CONSTRAINT IF EXISTS uq_skus_tenant_code;
ALTER TABLE IF EXISTS skus
  ADD CONSTRAINT uq_skus_tenant_code UNIQUE (tenant_id, code);

-- Indexes for performance and common filters
CREATE INDEX IF NOT EXISTS idx_skus_tenant_status ON skus (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_skus_product_id ON skus (tenant_id, product_id);

-- Row-Level Security Policy
ALTER TABLE skus ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS skus_tenant_isolation_policy ON skus;
CREATE POLICY skus_tenant_isolation_policy ON skus
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));
