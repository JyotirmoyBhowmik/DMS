-- =============================================================================
-- V015: Add RLS and constraints for kyc_documents table
-- =============================================================================

BEGIN;

-- Ensure RLS is enabled on kyc_documents
ALTER TABLE kyc_documents ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if any
DROP POLICY IF EXISTS kyc_documents_tenant_isolation ON kyc_documents;

-- Create Tenant Isolation Policy
CREATE POLICY kyc_documents_tenant_isolation ON kyc_documents
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Ensure composite index for tenant_id and status
CREATE INDEX IF NOT EXISTS idx_kyc_tenant_status ON kyc_documents (tenant_id, verification_status);

COMMIT;
