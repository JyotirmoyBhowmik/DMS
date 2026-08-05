-- V014: Sales Targets and Surveys

BEGIN;

CREATE TABLE sales_targets (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    agent_id UUID NOT NULL,
    period_month INTEGER NOT NULL,
    period_year INTEGER NOT NULL,
    target_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    achieved_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    target_type VARCHAR(50) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sales_targets_tenant_agent ON sales_targets (tenant_id, agent_id);

CREATE TRIGGER sales_targets_set_updated_at
  BEFORE UPDATE ON sales_targets
  FOR EACH ROW
  EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE surveys (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    outlet_id UUID NOT NULL,
    agent_id UUID NOT NULL,
    questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    responses JSONB NOT NULL DEFAULT '{}'::jsonb,
    completed_at TIMESTAMP WITH TIME ZONE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_surveys_tenant_outlet ON surveys (tenant_id, outlet_id);
CREATE INDEX idx_surveys_tenant_agent ON surveys (tenant_id, agent_id);

CREATE TRIGGER surveys_set_updated_at
  BEFORE UPDATE ON surveys
  FOR EACH ROW
  EXECUTE FUNCTION trg_set_updated_at();

COMMIT;
