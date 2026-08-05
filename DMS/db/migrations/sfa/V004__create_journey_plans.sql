-- =============================================================================
-- V004: Create journey_plans table for Sales Force Automation (SFA)
-- Pre-planned daily routes that assign outlets for agents to visit.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS journey_plans (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID         NOT NULL,
  agent_id          UUID         NOT NULL,
  beat_id           UUID         NOT NULL,
  plan_date         DATE         NOT NULL,
  planned_outlets   JSONB        NOT NULL DEFAULT '[]',
  visited_outlets   JSONB        NOT NULL DEFAULT '[]',
  total_planned     INTEGER      NOT NULL DEFAULT 0,
  total_visited     INTEGER      NOT NULL DEFAULT 0,
  adherence_pct     NUMERIC(5,2) GENERATED ALWAYS AS (
                      CASE WHEN total_planned > 0
                           THEN ROUND((total_visited::NUMERIC / total_planned) * 100, 2)
                           ELSE 0 END
                    ) STORED,
  status            VARCHAR(20)  NOT NULL DEFAULT 'PLANNED'
                      CHECK (status IN ('PLANNED','IN_PROGRESS','COMPLETED','SKIPPED')),
  remarks           TEXT,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  version           INTEGER      NOT NULL DEFAULT 1,
  UNIQUE(tenant_id, agent_id, plan_date)
);

COMMENT ON TABLE journey_plans IS 'Daily journey plans assigning outlets to agents along a beat';
COMMENT ON COLUMN journey_plans.planned_outlets IS 'Array of {outlet_id, sequence, expected_arrival} objects';
COMMENT ON COLUMN journey_plans.visited_outlets IS 'Array of {outlet_id, visit_id, visited_at} objects';
COMMENT ON COLUMN journey_plans.adherence_pct IS 'Computed adherence percentage';

CREATE INDEX idx_jp_tenant     ON journey_plans (tenant_id);
CREATE INDEX idx_jp_agent_date ON journey_plans (tenant_id, agent_id, plan_date DESC);
CREATE INDEX idx_jp_beat       ON journey_plans (tenant_id, beat_id);
CREATE INDEX idx_jp_status     ON journey_plans (tenant_id, status);
CREATE INDEX idx_jp_date       ON journey_plans (tenant_id, plan_date DESC);
CREATE INDEX idx_jp_planned    ON journey_plans USING GIN (planned_outlets jsonb_path_ops);

CREATE TRIGGER journey_plans_set_updated_at
  BEFORE UPDATE ON journey_plans
  FOR EACH ROW
  EXECUTE FUNCTION trg_set_updated_at();

COMMIT;
