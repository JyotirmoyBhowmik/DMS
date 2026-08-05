-- =============================================================================
-- V001: Create orders table for Sales Force Automation (SFA)
-- Tracks orders placed by field agents at retail outlets.
-- Monetary amounts stored as BIGINT in smallest currency unit (paise/cents).
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS orders (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID         NOT NULL,
  outlet_id         UUID         NOT NULL,
  agent_id          UUID         NOT NULL,
  distributor_id    UUID         NOT NULL,
  status            VARCHAR(20)  NOT NULL DEFAULT 'DRAFT'
                      CHECK (status IN ('DRAFT','PLACED','CONFIRMED','DISPATCHED','DELIVERED','CANCELLED','RETURNED')),
  lines             JSONB        NOT NULL DEFAULT '[]',
  scheme_ids        TEXT[]       NOT NULL DEFAULT '{}',
  gross_amount      BIGINT       NOT NULL DEFAULT 0 CHECK (gross_amount >= 0),
  discount_amount   BIGINT       NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  tax_amount        BIGINT       NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  net_amount        BIGINT       NOT NULL DEFAULT 0 CHECK (net_amount >= 0),
  currency          VARCHAR(3)   NOT NULL DEFAULT 'INR',
  customer_note     TEXT,            -- encrypted at rest via pgcrypto / Vault transit
  idempotency_key   VARCHAR(64)  NOT NULL,
  placed_at         TIMESTAMPTZ  NOT NULL,
  confirmed_at      TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ,
  cancel_reason     TEXT,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  version           INTEGER      NOT NULL DEFAULT 1,
  UNIQUE(tenant_id, idempotency_key)
);

COMMENT ON TABLE orders IS 'Sales orders placed by field agents for retail outlets';
COMMENT ON COLUMN orders.lines IS 'Array of {sku, qty, unit_price, tax_rate, line_total} objects';
COMMENT ON COLUMN orders.net_amount IS 'gross_amount - discount_amount + tax_amount, in smallest currency unit';
COMMENT ON COLUMN orders.customer_note IS 'Free-text note from customer; encrypted at rest';

-- Tenant-scoped indexes for common query patterns
CREATE INDEX idx_orders_tenant      ON orders (tenant_id);
CREATE INDEX idx_orders_outlet      ON orders (tenant_id, outlet_id);
CREATE INDEX idx_orders_agent       ON orders (tenant_id, agent_id);
CREATE INDEX idx_orders_distributor ON orders (tenant_id, distributor_id);
CREATE INDEX idx_orders_status      ON orders (tenant_id, status);
CREATE INDEX idx_orders_placed_at   ON orders (tenant_id, placed_at DESC);
CREATE INDEX idx_orders_lines_gin   ON orders USING GIN (lines jsonb_path_ops);

-- Trigger: auto-update updated_at on modification
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_set_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trg_set_updated_at();

COMMIT;
