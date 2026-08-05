-- =============================================================================
-- V025: Alter merchandising_audits table to add constraints, indexes and RLS
-- =============================================================================

BEGIN;

-- 1. Add status column with default 'DRAFT'
ALTER TABLE merchandising_audits 
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'DRAFT';

-- 2. Add CHECK constraint for status values
ALTER TABLE merchandising_audits
  ADD CONSTRAINT chk_merchandising_audits_status
  CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'));

-- 3. Add Foreign Key constraints
ALTER TABLE merchandising_audits
  ADD CONSTRAINT fk_merchandising_audits_agent
  FOREIGN KEY (agent_id) REFERENCES agents(id)
  ON DELETE CASCADE;

ALTER TABLE merchandising_audits
  ADD CONSTRAINT fk_merchandising_audits_outlet
  FOREIGN KEY (outlet_id) REFERENCES outlet_profiles(id)
  ON DELETE CASCADE;

ALTER TABLE merchandising_audits
  ADD CONSTRAINT fk_merchandising_audits_visit
  FOREIGN KEY (visit_id) REFERENCES visits(id)
  ON DELETE SET NULL;

-- 4. Add UNIQUE constraint (one audit session per agent per outlet per day)
ALTER TABLE merchandising_audits
  ADD CONSTRAINT uq_merchandising_audits_business_key
  UNIQUE (tenant_id, agent_id, outlet_id, audit_date);

-- 5. Create Composite Index on tenant_id and status
CREATE INDEX IF NOT EXISTS idx_merch_audits_tenant_status
  ON merchandising_audits (tenant_id, status);

-- 6. Enable Row-Level Security
ALTER TABLE merchandising_audits ENABLE ROW LEVEL SECURITY;

-- 7. Attach tenant isolation policy
DROP POLICY IF EXISTS merchandising_audits_tenant_isolation ON merchandising_audits;
CREATE POLICY merchandising_audits_tenant_isolation ON merchandising_audits
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

COMMIT;

-- =============================================================================
-- REVERSIBLE ROLLBACK DOWN-MIGRATION (for manual rollbacks)
-- =============================================================================
-- BEGIN;
-- DROP POLICY IF EXISTS merchandising_audits_tenant_isolation ON merchandising_audits;
-- ALTER TABLE merchandising_audits DISABLE ROW LEVEL SECURITY;
-- DROP INDEX IF EXISTS idx_merch_audits_tenant_status;
-- ALTER TABLE merchandising_audits DROP CONSTRAINT IF EXISTS uq_merchandising_audits_business_key;
-- ALTER TABLE merchandising_audits DROP CONSTRAINT IF EXISTS fk_merchandising_audits_visit;
-- ALTER TABLE merchandising_audits DROP CONSTRAINT IF EXISTS fk_merchandising_audits_outlet;
-- ALTER TABLE merchandising_audits DROP CONSTRAINT IF EXISTS fk_merchandising_audits_agent;
-- ALTER TABLE merchandising_audits DROP CONSTRAINT IF EXISTS chk_merchandising_audits_status;
-- ALTER TABLE merchandising_audits DROP COLUMN IF EXISTS status;
-- COMMIT;
