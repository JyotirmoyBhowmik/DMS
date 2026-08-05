-- =============================================================================
-- V002: Create visits table for Sales Force Automation (SFA)
-- Tracks field agent visits to retail outlets with geolocation and task data.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS visits (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID         NOT NULL,
  outlet_id         UUID         NOT NULL,
  agent_id          UUID         NOT NULL,
  journey_plan_id   UUID,
  check_in_time     TIMESTAMPTZ  NOT NULL,
  check_out_time    TIMESTAMPTZ,
  geo_lat           NUMERIC(10,7) NOT NULL,
  geo_lng           NUMERIC(10,7) NOT NULL,
  checkout_geo_lat  NUMERIC(10,7),
  checkout_geo_lng  NUMERIC(10,7),
  geo_accuracy_m    NUMERIC(8,2),
  tasks_completed   JSONB        NOT NULL DEFAULT '[]',
  photos            TEXT[]       NOT NULL DEFAULT '{}',
  status            VARCHAR(20)  NOT NULL DEFAULT 'CHECKED_IN'
                      CHECK (status IN ('CHECKED_IN','CHECKED_OUT','CANCELLED','SYNCED')),
  duration_secs     INTEGER      GENERATED ALWAYS AS (
                      CASE WHEN check_out_time IS NOT NULL
                           THEN EXTRACT(EPOCH FROM (check_out_time - check_in_time))::INTEGER
                           ELSE NULL END
                    ) STORED,
  notes             TEXT,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  version           INTEGER      NOT NULL DEFAULT 1
);

COMMENT ON TABLE visits IS 'Field agent visits to retail outlets with geolocation tracking';
COMMENT ON COLUMN visits.tasks_completed IS 'Array of {task_type, completed, remarks} objects';
COMMENT ON COLUMN visits.duration_secs IS 'Computed visit duration in seconds';
COMMENT ON COLUMN visits.photos IS 'Array of file-service object keys for visit photos';

CREATE INDEX idx_visits_tenant       ON visits (tenant_id);
CREATE INDEX idx_visits_outlet       ON visits (tenant_id, outlet_id);
CREATE INDEX idx_visits_agent        ON visits (tenant_id, agent_id);
CREATE INDEX idx_visits_checkin      ON visits (tenant_id, check_in_time DESC);
CREATE INDEX idx_visits_status       ON visits (tenant_id, status);
CREATE INDEX idx_visits_journey_plan ON visits (tenant_id, journey_plan_id)
  WHERE journey_plan_id IS NOT NULL;
CREATE INDEX idx_visits_tasks_gin    ON visits USING GIN (tasks_completed jsonb_path_ops);

CREATE TRIGGER visits_set_updated_at
  BEFORE UPDATE ON visits
  FOR EACH ROW
  EXECUTE FUNCTION trg_set_updated_at();

COMMIT;
