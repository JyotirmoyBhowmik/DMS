-- =============================================================================
-- V008: Create product_categories table
-- Hierarchical product categorization, max 4 levels deep.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS product_categories (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID          NOT NULL,
  name                  VARCHAR(255)  NOT NULL,
  parent_category_id    UUID          REFERENCES product_categories(id) ON DELETE SET NULL,
  level                 INTEGER       NOT NULL DEFAULT 1 CHECK (level >= 1 AND level <= 4),
  sort_order            INTEGER       NOT NULL DEFAULT 0,
  is_active             BOOLEAN       NOT NULL DEFAULT true,
  icon_url              VARCHAR(1024),
  description           TEXT,
  version               INTEGER       NOT NULL DEFAULT 1,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),

  -- Unique name within same parent (or at root level)
  CONSTRAINT uq_category_name_parent UNIQUE (tenant_id, parent_category_id, name)
);

-- Indexes
CREATE INDEX idx_pc_tenant           ON product_categories (tenant_id);
CREATE INDEX idx_pc_parent           ON product_categories (tenant_id, parent_category_id);
CREATE INDEX idx_pc_level            ON product_categories (tenant_id, level);
CREATE INDEX idx_pc_active           ON product_categories (tenant_id, is_active);

CREATE TRIGGER trg_pc_updated_at
  BEFORE UPDATE ON product_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
