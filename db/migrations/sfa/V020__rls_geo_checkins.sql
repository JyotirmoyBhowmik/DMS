-- =============================================================================
-- V020: Enable RLS, add foreign keys, check constraints, and composite indexes
-- Aligns geo_checkins with enterprise security and integrity rules.
-- =============================================================================

BEGIN;

-- Add check constraints for valid GPS coordinates
ALTER TABLE geo_checkins DROP CONSTRAINT IF EXISTS check_in_coords_valid;
ALTER TABLE geo_checkins ADD CONSTRAINT check_in_coords_valid 
  CHECK (check_in_lat BETWEEN -90 AND 90 AND check_in_lng BETWEEN -180 AND 180);

ALTER TABLE geo_checkins DROP CONSTRAINT IF EXISTS check_out_coords_valid;
ALTER TABLE geo_checkins ADD CONSTRAINT check_out_coords_valid 
  CHECK (check_out_time IS NULL OR (check_out_lat BETWEEN -90 AND 90 AND check_out_lng BETWEEN -180 AND 180));

-- Add foreign key constraint to visits table
ALTER TABLE geo_checkins DROP CONSTRAINT IF EXISTS fk_geo_checkins_visit;
ALTER TABLE geo_checkins ADD CONSTRAINT fk_geo_checkins_visit 
  FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE SET NULL;

-- Enable Row Level Security
ALTER TABLE geo_checkins ENABLE ROW LEVEL SECURITY;

-- Attach tenant isolation policy
DROP POLICY IF EXISTS geo_checkins_tenant_isolation ON geo_checkins;
CREATE POLICY geo_checkins_tenant_isolation ON geo_checkins
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- Create composite index on tenant + spoofing/geofence status
DROP INDEX IF EXISTS idx_geo_checkins_tenant_status;
CREATE INDEX idx_geo_checkins_tenant_status 
  ON geo_checkins (tenant_id, is_within_geofence, spoofing_detected);

COMMIT;
