-- =============================================================================
-- V021: Enable RLS, add foreign keys, check constraints, and composite indexes
-- Aligns outlet_census with enterprise security and integrity rules.
-- =============================================================================

BEGIN;

-- Add check constraints for valid GPS coordinates
ALTER TABLE outlet_census DROP CONSTRAINT IF EXISTS geo_coords_valid;
ALTER TABLE outlet_census ADD CONSTRAINT geo_coords_valid 
  CHECK (geo_lat BETWEEN -90 AND 90 AND geo_lng BETWEEN -180 AND 180);

-- Enable Row Level Security
ALTER TABLE outlet_census ENABLE ROW LEVEL SECURITY;

-- Attach tenant isolation policy
DROP POLICY IF EXISTS outlet_census_tenant_isolation ON outlet_census;
CREATE POLICY outlet_census_tenant_isolation ON outlet_census
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- Create composite index on tenant + status if not exists
DROP INDEX IF EXISTS idx_outlet_census_tenant_status;
CREATE INDEX idx_outlet_census_tenant_status 
  ON outlet_census (tenant_id, status);

COMMIT;
