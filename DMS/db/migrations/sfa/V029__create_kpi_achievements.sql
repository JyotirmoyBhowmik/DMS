-- =============================================================================
-- V029: Create kpi_achievements table for Sales Force Automation (SFA)
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS kpi_achievements (
  id                      UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID           NOT NULL,
  agent_id                UUID           NOT NULL,
  kpi_type                VARCHAR(50)    NOT NULL,
  period_month            INTEGER        NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year             INTEGER        NOT NULL,
  target_value            NUMERIC(15,2)  NOT NULL CHECK (target_value >= 0),
  achieved_value          NUMERIC(15,2)  NOT NULL DEFAULT 0 CHECK (achieved_value >= 0),
  status                  VARCHAR(30)    NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED')),
  created_at              TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ    NOT NULL DEFAULT now(),
  version                 INTEGER        NOT NULL DEFAULT 1
);

-- Foreign Keys
ALTER TABLE kpi_achievements
  ADD CONSTRAINT fk_kpi_achievements_agent
  FOREIGN KEY (agent_id) REFERENCES agents(id)
  ON DELETE CASCADE;

-- Uniqueness: One KPI type target per agent per month/year period
ALTER TABLE kpi_achievements
  ADD CONSTRAINT uq_kpi_achievements_agent_period
  UNIQUE (tenant_id, agent_id, period_month, period_year, kpi_type);

-- Indexes
CREATE INDEX idx_kpi_achievements_tenant         ON kpi_achievements (tenant_id);
CREATE INDEX idx_kpi_achievements_agent          ON kpi_achievements (tenant_id, agent_id);
CREATE INDEX idx_kpi_achievements_agent_period   ON kpi_achievements (tenant_id, agent_id, period_year, period_month);
CREATE INDEX idx_kpi_achievements_tenant_status  ON kpi_achievements (tenant_id, status);

-- Trigger for updated_at
CREATE TRIGGER kpi_achievements_set_updated_at
  BEFORE UPDATE ON kpi_achievements
  FOR EACH ROW
  EXECUTE FUNCTION trg_set_updated_at();

-- Enable RLS
ALTER TABLE kpi_achievements ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation policy
DROP POLICY IF EXISTS kpi_achievements_tenant_isolation ON kpi_achievements;
CREATE POLICY kpi_achievements_tenant_isolation ON kpi_achievements
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

COMMIT;
