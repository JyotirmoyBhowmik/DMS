-- =============================================================================
-- V031: Create surveys table for Sales Force Automation (SFA)
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS surveys (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID         NOT NULL,
  agent_id          UUID         NOT NULL,
  outlet_id         UUID         NOT NULL,
  title             VARCHAR(255) NOT NULL,
  description       TEXT,
  status            VARCHAR(30)  NOT NULL DEFAULT 'DRAFT'
                      CHECK (status IN ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED')),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  version           INTEGER      NOT NULL DEFAULT 1
);

-- Foreign Keys
ALTER TABLE surveys
  ADD CONSTRAINT fk_surveys_agent
  FOREIGN KEY (agent_id) REFERENCES agents(id)
  ON DELETE CASCADE;

ALTER TABLE surveys
  ADD CONSTRAINT fk_surveys_outlet
  FOREIGN KEY (outlet_id) REFERENCES outlet_profiles(id)
  ON DELETE CASCADE;

-- Business uniqueness
ALTER TABLE surveys
  ADD CONSTRAINT uq_surveys_business_key
  UNIQUE (tenant_id, outlet_id, agent_id, title);

-- Indexes
CREATE INDEX idx_surveys_tenant         ON surveys (tenant_id);
CREATE INDEX idx_surveys_agent          ON surveys (tenant_id, agent_id);
CREATE INDEX idx_surveys_outlet         ON surveys (tenant_id, outlet_id);
CREATE INDEX idx_surveys_tenant_status  ON surveys (tenant_id, status);

-- Trigger for updated_at
CREATE TRIGGER surveys_set_updated_at
  BEFORE UPDATE ON surveys
  FOR EACH ROW
  EXECUTE FUNCTION trg_set_updated_at();

-- Enable RLS
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation policy
DROP POLICY IF EXISTS surveys_tenant_isolation ON surveys;
CREATE POLICY surveys_tenant_isolation ON surveys
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

COMMIT;

-- Rollback description:
-- BEGIN;
-- DROP POLICY IF EXISTS surveys_tenant_isolation ON surveys;
-- ALTER TABLE surveys DISABLE ROW LEVEL SECURITY;
-- DROP TRIGGER IF EXISTS surveys_set_updated_at ON surveys;
-- DROP INDEX IF EXISTS idx_surveys_tenant_status;
-- DROP INDEX IF EXISTS idx_surveys_outlet;
-- DROP INDEX IF EXISTS idx_surveys_agent;
-- DROP INDEX IF EXISTS idx_surveys_tenant;
-- ALTER TABLE surveys DROP CONSTRAINT IF EXISTS uq_surveys_business_key;
-- ALTER TABLE surveys DROP CONSTRAINT IF EXISTS fk_surveys_outlet;
-- ALTER TABLE surveys DROP CONSTRAINT IF EXISTS fk_surveys_agent;
-- DROP TABLE IF EXISTS surveys;
-- COMMIT;
