-- =============================================================================
-- V016: Add RLS and constraints for credit_limits table
-- =============================================================================

BEGIN;

-- Ensure RLS is enabled on credit_limits
ALTER TABLE credit_limits ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if any
DROP POLICY IF EXISTS credit_limits_tenant_isolation ON credit_limits;

-- Create Tenant Isolation Policy
CREATE POLICY credit_limits_tenant_isolation ON credit_limits
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Ensure composite index for tenant_id and credit_rating
CREATE INDEX IF NOT EXISTS idx_cl_tenant_rating ON credit_limits (tenant_id, credit_rating);

COMMIT;
