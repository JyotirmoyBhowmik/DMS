-- =============================================================================
-- V007: Create beat_routes table for Sales Force Automation (SFA)
-- Defines territory routes assigned to agents with ordered outlet sequences.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS beat_routes (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID         NOT NULL,
  name                VARCHAR(255) NOT NULL,
  region              VARCHAR(128) NOT NULL,
  assigned_agent_ids  UUID[]       NOT NULL DEFAULT '{}',
  outlets             JSONB        NOT NULL DEFAULT '[]',
  frequency           VARCHAR(20)  NOT NULL DEFAULT 'daily'
                        CHECK (frequency IN ('daily','weekly','monthly')),
  status              VARCHAR(20)  NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','active','suspended','archived')),
  is_active           BOOLEAN      NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  version             INTEGER      NOT NULL DEFAULT 1,

  -- Business rule: max 30 outlets per beat route
  CONSTRAINT chk_max_outlets CHECK (jsonb_array_length(outlets) <= 30)
);

COMMENT ON TABLE beat_routes IS 'Territory beat routes with ordered outlet sequences assigned to agents';
COMMENT ON COLUMN beat_routes.outlets IS 'Array of {outletId, sequence, lat, lng} objects, max 30';
COMMENT ON COLUMN beat_routes.assigned_agent_ids IS 'UUIDs of agents assigned to this beat route';
COMMENT ON COLUMN beat_routes.frequency IS 'How often this route is run: daily, weekly, or monthly';

-- Tenant-scoped indexes
CREATE INDEX idx_beat_routes_tenant    ON beat_routes (tenant_id);
CREATE INDEX idx_beat_routes_region    ON beat_routes (tenant_id, region);
CREATE INDEX idx_beat_routes_status    ON beat_routes (tenant_id, status);
CREATE INDEX idx_beat_routes_active    ON beat_routes (tenant_id, is_active) WHERE is_active = true;
CREATE INDEX idx_beat_routes_agents    ON beat_routes USING GIN (assigned_agent_ids);
CREATE INDEX idx_beat_routes_outlets   ON beat_routes USING GIN (outlets jsonb_path_ops);

CREATE TRIGGER beat_routes_set_updated_at
  BEFORE UPDATE ON beat_routes
  FOR EACH ROW
  EXECUTE FUNCTION trg_set_updated_at();

COMMIT;
