-- =============================================================================
-- V013: Create merchandising_audits table for Sales Force Automation (SFA)
-- Captures shelf compliance, planogram adherence, pricing, and brand share data.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS merchandising_audits (
  id                      UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID           NOT NULL,
  agent_id                UUID           NOT NULL,
  outlet_id               UUID           NOT NULL,
  visit_id                UUID,
  audit_date              DATE           NOT NULL,
  shelf_photos            JSONB          NOT NULL DEFAULT '[]',
  planogram_compliance    NUMERIC(5,2)   NOT NULL DEFAULT 0
                            CHECK (planogram_compliance >= 0 AND planogram_compliance <= 100),
  shelf_share_by_brand    JSONB          NOT NULL DEFAULT '[]',
  out_of_stock_skus       TEXT[]         NOT NULL DEFAULT '{}',
  pricing_audit           JSONB          NOT NULL DEFAULT '[]',
  display_score           NUMERIC(5,2)   NOT NULL DEFAULT 0
                            CHECK (display_score >= 0 AND display_score <= 100),
  notes                   TEXT,
  created_at              TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ    NOT NULL DEFAULT now(),
  version                 INTEGER        NOT NULL DEFAULT 1
);

COMMENT ON TABLE merchandising_audits IS 'Shelf and display compliance audits performed by agents at outlets';
COMMENT ON COLUMN merchandising_audits.shelf_photos IS 'Array of {photoUrl, category, timestamp} objects';
COMMENT ON COLUMN merchandising_audits.planogram_compliance IS 'Percentage compliance with expected planogram (0-100)';
COMMENT ON COLUMN merchandising_audits.shelf_share_by_brand IS 'Array of {brand, percentage} shelf share data';
COMMENT ON COLUMN merchandising_audits.out_of_stock_skus IS 'SKU identifiers found out of stock';
COMMENT ON COLUMN merchandising_audits.pricing_audit IS 'Array of {skuId, listedPrice, actualPrice} pricing checks';
COMMENT ON COLUMN merchandising_audits.display_score IS 'Overall display quality score (0-100)';

-- Tenant-scoped indexes
CREATE INDEX idx_merch_audits_tenant     ON merchandising_audits (tenant_id);
CREATE INDEX idx_merch_audits_agent      ON merchandising_audits (tenant_id, agent_id);
CREATE INDEX idx_merch_audits_outlet     ON merchandising_audits (tenant_id, outlet_id);
CREATE INDEX idx_merch_audits_visit      ON merchandising_audits (tenant_id, visit_id) WHERE visit_id IS NOT NULL;
CREATE INDEX idx_merch_audits_date       ON merchandising_audits (tenant_id, audit_date DESC);
CREATE INDEX idx_merch_audits_photos     ON merchandising_audits USING GIN (shelf_photos jsonb_path_ops);
CREATE INDEX idx_merch_audits_pricing    ON merchandising_audits USING GIN (pricing_audit jsonb_path_ops);
CREATE INDEX idx_merch_audits_oos        ON merchandising_audits USING GIN (out_of_stock_skus);

CREATE TRIGGER merchandising_audits_set_updated_at
  BEFORE UPDATE ON merchandising_audits
  FOR EACH ROW
  EXECUTE FUNCTION trg_set_updated_at();

COMMIT;
