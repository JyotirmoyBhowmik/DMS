-- =============================================================================
-- V018: Enable RLS, drop check constraints, and update nullable columns in visits
-- Enforces strict tenant isolation and aligns status enums with domain models.
-- =============================================================================

ALTER TABLE visits DROP CONSTRAINT IF EXISTS visits_status_check;

ALTER TABLE visits ADD CONSTRAINT visits_status_check 
  CHECK (status IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'));

ALTER TABLE visits ALTER COLUMN check_in_time DROP NOT NULL;
ALTER TABLE visits ALTER COLUMN geo_lat DROP NOT NULL;
ALTER TABLE visits ALTER COLUMN geo_lng DROP NOT NULL;

ALTER TABLE visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS visits_tenant_isolation ON visits;

CREATE POLICY visits_tenant_isolation ON visits
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
