-- Migration V043: Add Claim constraints, indexes, RLS policies, and optimistic locking version column

CREATE TABLE IF NOT EXISTS claims (
  id VARCHAR(255) PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,
  distributor_id VARCHAR(255) NOT NULL,
  scheme_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  claim_code VARCHAR(255) NOT NULL,
  claim_amount_cents BIGINT NOT NULL DEFAULT 0,
  approved_amount_cents BIGINT NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'SUBMITTED',
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_claims_code UNIQUE (tenant_id, claim_code)
);

-- Constraints enforcing non-negative claim and approved amounts
ALTER TABLE IF EXISTS claims
  DROP CONSTRAINT IF EXISTS chk_claims_non_negative_amounts;
ALTER TABLE IF EXISTS claims
  ADD CONSTRAINT chk_claims_non_negative_amounts CHECK (claim_amount_cents >= 0 AND approved_amount_cents >= 0);

-- Indexes for performance and common filters
CREATE INDEX IF NOT EXISTS idx_claims_tenant_status ON claims (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_claims_tenant_distributor ON claims (tenant_id, distributor_id);

-- Row-Level Security Policy
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS claims_tenant_isolation_policy ON claims;
CREATE POLICY claims_tenant_isolation_policy ON claims
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));
