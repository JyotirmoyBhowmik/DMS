-- =============================================================================
-- V011: Create price_lists and price_list_entries tables
-- Named price lists with date-range validity and per-product pricing.
-- All monetary values stored as BIGINT (paise/cents).
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS price_lists (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID          NOT NULL,
  name                  VARCHAR(255)  NOT NULL,
  effective_from        DATE          NOT NULL,
  effective_to          DATE,
  is_active             BOOLEAN       NOT NULL DEFAULT true,
  version               INTEGER       NOT NULL DEFAULT 1,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT uq_price_list_name UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS price_list_entries (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  price_list_id         UUID          NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
  product_id            UUID          NOT NULL REFERENCES products_skus(id) ON DELETE RESTRICT,
  base_price            BIGINT        NOT NULL CHECK (base_price >= 0),
  mrp                   BIGINT        NOT NULL CHECK (mrp >= 0),
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT uq_ple_product UNIQUE (price_list_id, product_id),
  CONSTRAINT chk_mrp_gte_base CHECK (mrp >= base_price)
);

-- Indexes
CREATE INDEX idx_pl_tenant           ON price_lists (tenant_id);
CREATE INDEX idx_pl_active           ON price_lists (tenant_id, is_active);
CREATE INDEX idx_pl_dates            ON price_lists (effective_from, effective_to);
CREATE INDEX idx_ple_list            ON price_list_entries (price_list_id);
CREATE INDEX idx_ple_product         ON price_list_entries (product_id);

CREATE TRIGGER trg_pl_updated_at
  BEFORE UPDATE ON price_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_ple_updated_at
  BEFORE UPDATE ON price_list_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
