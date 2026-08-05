-- =============================================================================
-- V001: Create tables for Distributor Management System (DMS)
-- Tracks distributors, products, SKUs, inventory, and retail outlets.
-- =============================================================================

BEGIN;

-- 1. Distributors Table
CREATE TABLE IF NOT EXISTS distributors (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID          NOT NULL,
  name            VARCHAR(255)  NOT NULL,
  region          VARCHAR(100)  NOT NULL,
  credit_limit    BIGINT        NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
  balance         BIGINT        NOT NULL DEFAULT 0,
  version         INTEGER       NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- 2. Products / SKUs Table
CREATE TABLE IF NOT EXISTS products_skus (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID          NOT NULL,
  sku             VARCHAR(100)  NOT NULL,
  name            VARCHAR(255)  NOT NULL,
  category        VARCHAR(100)  NOT NULL,
  price           BIGINT        NOT NULL DEFAULT 0 CHECK (price >= 0),
  min_threshold   INTEGER       NOT NULL DEFAULT 10 CHECK (min_threshold >= 0),
  version         INTEGER       NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, sku)
);

-- 3. Inventory Records Table
CREATE TABLE IF NOT EXISTS inventory_records (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID          NOT NULL,
  product_id      UUID          NOT NULL REFERENCES products_skus(id) ON DELETE CASCADE,
  warehouse_id    VARCHAR(100)  NOT NULL,
  stock           INTEGER       NOT NULL DEFAULT 0 CHECK (stock >= 0),
  version         INTEGER       NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, product_id, warehouse_id)
);

-- 4. Retail Outlets Table
CREATE TABLE IF NOT EXISTS retail_outlets (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID          NOT NULL,
  name            VARCHAR(255)  NOT NULL,
  latitude        DOUBLE PRECISION NOT NULL,
  longitude       DOUBLE PRECISION NOT NULL,
  radius_meters   INTEGER       NOT NULL DEFAULT 50,
  version         INTEGER       NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Tenant indexing
CREATE INDEX idx_distributors_tenant ON distributors (tenant_id);
CREATE INDEX idx_products_sku_tenant ON products_skus (tenant_id, sku);
CREATE INDEX idx_inventory_product   ON inventory_records (tenant_id, product_id);
CREATE INDEX idx_outlets_tenant      ON retail_outlets (tenant_id);

COMMIT;
