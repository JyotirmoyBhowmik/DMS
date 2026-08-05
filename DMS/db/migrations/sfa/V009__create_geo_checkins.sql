-- =============================================================================
-- V009: Create geo_checkins table for Sales Force Automation (SFA)
-- Tracks GPS-verified check-ins at outlets with geofence and spoofing data.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS geo_checkins (
  id                    UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID           NOT NULL,
  agent_id              UUID           NOT NULL,
  outlet_id             UUID           NOT NULL,
  visit_id              UUID,
  check_in_time         TIMESTAMPTZ    NOT NULL,
  check_out_time        TIMESTAMPTZ,
  check_in_lat          NUMERIC(10,7)  NOT NULL,
  check_in_lng          NUMERIC(10,7)  NOT NULL,
  check_out_lat         NUMERIC(10,7),
  check_out_lng         NUMERIC(10,7),
  distance_from_outlet  NUMERIC(10,2)  NOT NULL DEFAULT 0 CHECK (distance_from_outlet >= 0),
  is_within_geofence    BOOLEAN        NOT NULL DEFAULT false,
  spoofing_detected     BOOLEAN        NOT NULL DEFAULT false,
  device_info           JSONB          NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ    NOT NULL DEFAULT now(),
  version               INTEGER        NOT NULL DEFAULT 1
);

COMMENT ON TABLE geo_checkins IS 'GPS-verified agent check-ins at outlets with geofence and anti-spoofing data';
COMMENT ON COLUMN geo_checkins.distance_from_outlet IS 'Distance in metres from the outlet coordinates at check-in';
COMMENT ON COLUMN geo_checkins.device_info IS '{model, os, batteryLevel} of the agent device';
COMMENT ON COLUMN geo_checkins.spoofing_detected IS 'Whether GPS spoofing was detected during check-in';

-- Tenant-scoped indexes
CREATE INDEX idx_geo_checkins_tenant      ON geo_checkins (tenant_id);
CREATE INDEX idx_geo_checkins_agent       ON geo_checkins (tenant_id, agent_id);
CREATE INDEX idx_geo_checkins_outlet      ON geo_checkins (tenant_id, outlet_id);
CREATE INDEX idx_geo_checkins_visit       ON geo_checkins (tenant_id, visit_id) WHERE visit_id IS NOT NULL;
CREATE INDEX idx_geo_checkins_time        ON geo_checkins (tenant_id, check_in_time DESC);
CREATE INDEX idx_geo_checkins_spoofing    ON geo_checkins (tenant_id, spoofing_detected) WHERE spoofing_detected = true;
CREATE INDEX idx_geo_checkins_geofence    ON geo_checkins (tenant_id, is_within_geofence);
CREATE INDEX idx_geo_checkins_device_gin  ON geo_checkins USING GIN (device_info jsonb_path_ops);

CREATE TRIGGER geo_checkins_set_updated_at
  BEFORE UPDATE ON geo_checkins
  FOR EACH ROW
  EXECUTE FUNCTION trg_set_updated_at();

COMMIT;
