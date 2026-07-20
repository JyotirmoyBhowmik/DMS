-- =============================================================================
-- V027: Create photo_captures table for Sales Force Automation (SFA)
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS photo_captures (
  id                      UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID           NOT NULL,
  agent_id                UUID           NOT NULL,
  outlet_id               UUID           NOT NULL,
  capture_date            DATE           NOT NULL,
  photo_url               TEXT           NOT NULL,
  tags                    TEXT[]         NOT NULL DEFAULT '{}',
  notes                   TEXT,
  status                  VARCHAR(30)    NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED')),
  created_at              TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ    NOT NULL DEFAULT now(),
  version                 INTEGER        NOT NULL DEFAULT 1
);

-- Foreign Keys
ALTER TABLE photo_captures
  ADD CONSTRAINT fk_photo_captures_agent
  FOREIGN KEY (agent_id) REFERENCES agents(id)
  ON DELETE CASCADE;

ALTER TABLE photo_captures
  ADD CONSTRAINT fk_photo_captures_outlet
  FOREIGN KEY (outlet_id) REFERENCES outlet_profiles(id)
  ON DELETE CASCADE;

-- Business uniqueness: one capture per agent/outlet/photo_url
ALTER TABLE photo_captures
  ADD CONSTRAINT uq_photo_captures_business_key
  UNIQUE (tenant_id, agent_id, outlet_id, photo_url);

-- Indexes
CREATE INDEX idx_photo_captures_tenant         ON photo_captures (tenant_id);
CREATE INDEX idx_photo_captures_agent          ON photo_captures (tenant_id, agent_id);
CREATE INDEX idx_photo_captures_outlet         ON photo_captures (tenant_id, outlet_id);
CREATE INDEX idx_photo_captures_tenant_status  ON photo_captures (tenant_id, status);

-- Trigger for updated_at
CREATE TRIGGER photo_captures_set_updated_at
  BEFORE UPDATE ON photo_captures
  FOR EACH ROW
  EXECUTE FUNCTION trg_set_updated_at();

-- Enable RLS
ALTER TABLE photo_captures ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation policy
DROP POLICY IF EXISTS photo_captures_tenant_isolation ON photo_captures;
CREATE POLICY photo_captures_tenant_isolation ON photo_captures
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

COMMIT;
