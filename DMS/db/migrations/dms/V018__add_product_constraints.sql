-- Migration V018: Add Product constraints, indexes, RLS policies, and optimistic locking version column

CREATE TABLE IF NOT EXISTS products_skus (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID          NOT NULL,
  sku             VARCHAR(100)  NOT NULL,
  name            VARCHAR(255)  NOT NULL,
  category        VARCHAR(100)  NOT NULL,
  price           BIGINT        NOT NULL DEFAULT 0,
  min_threshold   INTEGER       NOT NULL DEFAULT 10,
  version         INTEGER       NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS products_skus
  ADD COLUMN IF NOT EXISTS uom VARCHAR(30) NOT NULL DEFAULT 'UNIT',
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Unique SKU constraint per tenant
ALTER TABLE IF EXISTS products_skus
  DROP CONSTRAINT IF EXISTS uq_products_tenant_sku;
ALTER TABLE IF EXISTS products_skus
  ADD CONSTRAINT uq_products_tenant_sku UNIQUE (tenant_id, sku);

-- Indexes for performance and common filters
CREATE INDEX IF NOT EXISTS idx_products_tenant_status ON products_skus (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_products_category ON products_skus (tenant_id, category);

-- Row-Level Security Policy
ALTER TABLE products_skus ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS products_tenant_isolation_policy ON products_skus;
CREATE POLICY products_tenant_isolation_policy ON products_skus
  FOR ALL
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
