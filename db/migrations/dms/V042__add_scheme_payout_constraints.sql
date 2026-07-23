-- Migration V042: Add SchemePayout constraints, indexes, RLS policies, and optimistic locking version column

CREATE TABLE IF NOT EXISTS scheme_payouts (
  id VARCHAR(255) PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,
  scheme_id VARCHAR(255) NOT NULL,
  distributor_id VARCHAR(255) NOT NULL,
  claim_id VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  payout_code VARCHAR(255) NOT NULL,
  amount_cents BIGINT NOT NULL DEFAULT 0,
  payout_type VARCHAR(50) NOT NULL DEFAULT 'CREDIT_NOTE',
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_scheme_payouts_code UNIQUE (tenant_id, scheme_id, payout_code)
);

-- Constraints enforcing non-negative payout amount
ALTER TABLE IF EXISTS scheme_payouts
  DROP CONSTRAINT IF EXISTS chk_scheme_payouts_non_negative_amount;
ALTER TABLE IF EXISTS scheme_payouts
  ADD CONSTRAINT chk_scheme_payouts_non_negative_amount CHECK (amount_cents >= 0);

-- Indexes for performance and common filters
CREATE INDEX IF NOT EXISTS idx_scheme_payouts_tenant_status ON scheme_payouts (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_scheme_payouts_tenant_distributor ON scheme_payouts (tenant_id, distributor_id);

-- Row-Level Security Policy
ALTER TABLE scheme_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scheme_payouts_tenant_isolation_policy ON scheme_payouts;
CREATE POLICY scheme_payouts_tenant_isolation_policy ON scheme_payouts
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));
