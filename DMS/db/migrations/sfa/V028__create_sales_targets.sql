-- =============================================================================
-- V028: Create sales_targets table for Sales Force Automation (SFA)
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS sales_targets (
  id                      UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID           NOT NULL,
  agent_id                UUID           NOT NULL,
  period_month            INTEGER        NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year             INTEGER        NOT NULL,
  target_amount           NUMERIC(15,2)  NOT NULL CHECK (target_amount >= 0),
  achieved_amount         NUMERIC(15,2)  NOT NULL DEFAULT 0 CHECK (achieved_amount >= 0),
  target_type             VARCHAR(50)    NOT NULL DEFAULT 'volume',
  status                  VARCHAR(30)    NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELLED')),
  created_at              TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ    NOT NULL DEFAULT now(),
  version                 INTEGER        NOT NULL DEFAULT 1
);

-- Foreign Keys
ALTER TABLE sales_targets
  ADD CONSTRAINT fk_sales_targets_agent
  FOREIGN KEY (agent_id) REFERENCES agents(id)
  ON DELETE CASCADE;

-- Uniqueness: One target type per agent per month/year period
ALTER TABLE sales_targets
  ADD CONSTRAINT uq_sales_targets_agent_period
  UNIQUE (tenant_id, agent_id, period_month, period_year, target_type);

-- Indexes
CREATE INDEX idx_sales_targets_tenant         ON sales_targets (tenant_id);
CREATE INDEX idx_sales_targets_agent          ON sales_targets (tenant_id, agent_id);
CREATE INDEX idx_sales_targets_agent_period   ON sales_targets (tenant_id, agent_id, period_year, period_month);
CREATE INDEX idx_sales_targets_tenant_status  ON sales_targets (tenant_id, status);

-- Trigger for updated_at
CREATE TRIGGER sales_targets_set_updated_at
  BEFORE UPDATE ON sales_targets
  FOR EACH ROW
  EXECUTE FUNCTION trg_set_updated_at();

-- Enable RLS
ALTER TABLE sales_targets ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation policy
DROP POLICY IF EXISTS sales_targets_tenant_isolation ON sales_targets;
CREATE POLICY sales_targets_tenant_isolation ON sales_targets
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

COMMIT;
