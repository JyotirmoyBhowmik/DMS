-- =============================================================================
-- V026: Create competitor_captures table for Sales Force Automation (SFA)
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS competitor_captures (
  id                      UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID           NOT NULL,
  agent_id                UUID           NOT NULL,
  outlet_id               UUID           NOT NULL,
  capture_date            DATE           NOT NULL,
  brand                   VARCHAR(200)   NOT NULL,
  sku_id                  VARCHAR(100)   NOT NULL,
  observed_price_cents    INTEGER        NOT NULL CHECK (observed_price_cents >= 0),
  observed_price_currency VARCHAR(3)     NOT NULL DEFAULT 'INR',
  promotion_details       TEXT,
  photo_url               TEXT,
  notes                   TEXT,
  status                  VARCHAR(30)    NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED')),
  created_at              TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ    NOT NULL DEFAULT now(),
  version                 INTEGER        NOT NULL DEFAULT 1
);

-- Foreign Keys
ALTER TABLE competitor_captures
  ADD CONSTRAINT fk_competitor_captures_agent
  FOREIGN KEY (agent_id) REFERENCES agents(id)
  ON DELETE CASCADE;

ALTER TABLE competitor_captures
  ADD CONSTRAINT fk_competitor_captures_outlet
  FOREIGN KEY (outlet_id) REFERENCES outlet_profiles(id)
  ON DELETE CASCADE;

-- Business uniqueness: one competitor product capture per agent/outlet/date/brand/sku
ALTER TABLE competitor_captures
  ADD CONSTRAINT uq_competitor_captures_business_key
  UNIQUE (tenant_id, agent_id, outlet_id, capture_date, brand, sku_id);

-- Indexes
CREATE INDEX idx_competitor_captures_tenant         ON competitor_captures (tenant_id);
CREATE INDEX idx_competitor_captures_agent          ON competitor_captures (tenant_id, agent_id);
CREATE INDEX idx_competitor_captures_outlet         ON competitor_captures (tenant_id, outlet_id);
CREATE INDEX idx_competitor_captures_date           ON competitor_captures (tenant_id, capture_date DESC);
CREATE INDEX idx_competitor_captures_tenant_status  ON competitor_captures (tenant_id, status);

-- Trigger for updated_at
CREATE TRIGGER competitor_captures_set_updated_at
  BEFORE UPDATE ON competitor_captures
  FOR EACH ROW
  EXECUTE FUNCTION trg_set_updated_at();

-- Enable RLS
ALTER TABLE competitor_captures ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation policy
DROP POLICY IF EXISTS competitor_captures_tenant_isolation ON competitor_captures;
CREATE POLICY competitor_captures_tenant_isolation ON competitor_captures
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

COMMIT;

-- Rollback description:
-- BEGIN;
-- DROP POLICY IF EXISTS competitor_captures_tenant_isolation ON competitor_captures;
-- ALTER TABLE competitor_captures DISABLE ROW LEVEL SECURITY;
-- DROP TRIGGER IF EXISTS competitor_captures_set_updated_at ON competitor_captures;
-- DROP INDEX IF EXISTS idx_competitor_captures_tenant_status;
-- DROP INDEX IF EXISTS idx_competitor_captures_date;
-- DROP INDEX IF EXISTS idx_competitor_captures_outlet;
-- DROP INDEX IF EXISTS idx_competitor_captures_agent;
-- DROP INDEX IF EXISTS idx_competitor_captures_tenant;
-- ALTER TABLE competitor_captures DROP CONSTRAINT IF EXISTS uq_competitor_captures_business_key;
-- ALTER TABLE competitor_captures DROP CONSTRAINT IF EXISTS fk_competitor_captures_outlet;
-- ALTER TABLE competitor_captures DROP CONSTRAINT IF EXISTS fk_competitor_captures_agent;
-- DROP TABLE IF EXISTS competitor_captures;
-- COMMIT;
