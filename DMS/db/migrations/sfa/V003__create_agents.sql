-- =============================================================================
-- V003: Create agents table for Sales Force Automation (SFA)
-- Field sales representatives who visit outlets and place orders.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS agents (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID         NOT NULL,
  user_id           UUID         NOT NULL,
  distributor_id    UUID,
  employee_code     VARCHAR(32)  NOT NULL,
  first_name        VARCHAR(128) NOT NULL,
  last_name         VARCHAR(128) NOT NULL,
  email             VARCHAR(256),            -- encrypted at rest
  phone             VARCHAR(20)  NOT NULL,   -- encrypted at rest
  designation       VARCHAR(64),
  reporting_to      UUID,
  territory_ids     TEXT[]       NOT NULL DEFAULT '{}',
  beat_ids          TEXT[]       NOT NULL DEFAULT '{}',
  device_id         VARCHAR(128),
  last_known_lat    NUMERIC(10,7),
  last_known_lng    NUMERIC(10,7),
  last_location_at  TIMESTAMPTZ,
  status            VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE'
                      CHECK (status IN ('ACTIVE','INACTIVE','SUSPENDED','TERMINATED')),
  metadata          JSONB        NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  version           INTEGER      NOT NULL DEFAULT 1,
  UNIQUE(tenant_id, employee_code),
  UNIQUE(tenant_id, user_id)
);

COMMENT ON TABLE agents IS 'Field sales agents / representatives';
COMMENT ON COLUMN agents.email IS 'Agent email; encrypted at rest';
COMMENT ON COLUMN agents.phone IS 'Agent phone; encrypted at rest';
COMMENT ON COLUMN agents.reporting_to IS 'Self-referencing FK to agents.id for hierarchy';

ALTER TABLE agents
  ADD CONSTRAINT fk_agents_reporting_to
  FOREIGN KEY (reporting_to) REFERENCES agents(id) ON DELETE SET NULL;

CREATE INDEX idx_agents_tenant       ON agents (tenant_id);
CREATE INDEX idx_agents_user         ON agents (tenant_id, user_id);
CREATE INDEX idx_agents_distributor  ON agents (tenant_id, distributor_id)
  WHERE distributor_id IS NOT NULL;
CREATE INDEX idx_agents_status       ON agents (tenant_id, status);
CREATE INDEX idx_agents_reporting    ON agents (tenant_id, reporting_to)
  WHERE reporting_to IS NOT NULL;
CREATE INDEX idx_agents_territory    ON agents USING GIN (territory_ids);

CREATE TRIGGER agents_set_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW
  EXECUTE FUNCTION trg_set_updated_at();

COMMIT;
