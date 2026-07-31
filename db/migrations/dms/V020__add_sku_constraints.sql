-- Migration V020: Add SKU constraints, indexes, RLS policies, and optimistic locking version column

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
  ADD COLUMN IF NOT EXISTS barcode VARCHAR(100),
  ADD COLUMN IF NOT EXISTS ean VARCHAR(100),
  ADD COLUMN IF NOT EXISTS unit_price INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Indexes for performance and common filters
CREATE INDEX IF NOT EXISTS idx_skus_tenant_status ON products_skus (tenant_id, status);

-- Row-Level Security Policy
ALTER TABLE products_skus ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS skus_tenant_isolation_policy ON products_skus;
CREATE POLICY skus_tenant_isolation_policy ON products_skus
  FOR ALL
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
