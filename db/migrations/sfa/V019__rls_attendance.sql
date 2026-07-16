-- =============================================================================
-- V019: Enable RLS and tenant policy for attendance table
-- =============================================================================

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS attendance_tenant_isolation ON attendance;

CREATE POLICY attendance_tenant_isolation ON attendance
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
