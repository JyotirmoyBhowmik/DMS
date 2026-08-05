-- =============================================================================
-- V012: Alter dms_outbox, create distributor_onboarding_workflows,
-- and enable Row-Level Security (RLS) on all distributor lifecycle tables.
-- =============================================================================

BEGIN;

-- 1. Alter dms_outbox to support next_attempt_at and set destination_topic default
ALTER TABLE dms_outbox ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE dms_outbox ALTER COLUMN destination_topic SET DEFAULT 'dms-events';

-- 2. Create distributor_onboarding_workflows table
CREATE TABLE IF NOT EXISTS distributor_onboarding_workflows (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID          NOT NULL,
  distributor_id        UUID          NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
  current_stage         VARCHAR(30)   NOT NULL CHECK (current_stage IN ('DRAFT', 'KYC_PENDING', 'CREDIT_CHECK', 'CONTRACT_SIGNATURE', 'ACTIVE')),
  kyc_status            VARCHAR(20)   NOT NULL DEFAULT 'PENDING',
  credit_check_status   VARCHAR(20)   NOT NULL DEFAULT 'PENDING',
  contract_signed       BOOLEAN       NOT NULL DEFAULT false,
  approved_by           UUID,
  version               INTEGER       NOT NULL DEFAULT 1,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT uq_dow_distributor UNIQUE (tenant_id, distributor_id)
);

-- Indexes for onboarding workflows
CREATE INDEX idx_dow_tenant ON distributor_onboarding_workflows (tenant_id);
CREATE INDEX idx_dow_distributor ON distributor_onboarding_workflows (tenant_id, distributor_id);

-- Trigger for auto-updating updated_at on distributor_onboarding_workflows
CREATE TRIGGER trg_dow_updated_at
  BEFORE UPDATE ON distributor_onboarding_workflows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. Enable RLS and create tenant isolation policies on all 5 tables
ALTER TABLE distributors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_distributors ON distributors;
CREATE POLICY tenant_isolation_distributors ON distributors
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

ALTER TABLE distributor_hierarchy ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_distributor_hierarchy ON distributor_hierarchy;
CREATE POLICY tenant_isolation_distributor_hierarchy ON distributor_hierarchy
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

ALTER TABLE kyc_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_kyc_documents ON kyc_documents;
CREATE POLICY tenant_isolation_kyc_documents ON kyc_documents
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

ALTER TABLE credit_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_credit_limits ON credit_limits;
CREATE POLICY tenant_isolation_credit_limits ON credit_limits
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

ALTER TABLE distributor_onboarding_workflows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_dow ON distributor_onboarding_workflows;
CREATE POLICY tenant_isolation_dow ON distributor_onboarding_workflows
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

COMMIT;
