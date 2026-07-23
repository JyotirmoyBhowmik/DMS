-- Migration: Add SchemeClaim Table, Indexes, Constraints and RLS Policy
-- Version: V044

CREATE TABLE IF NOT EXISTS scheme_claims (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    claim_code VARCHAR(100) NOT NULL,
    scheme_id UUID NOT NULL,
    distributor_id UUID NOT NULL,
    claim_amount_cents BIGINT NOT NULL CHECK (claim_amount_cents >= 0),
    approved_amount_cents BIGINT NOT NULL DEFAULT 0 CHECK (approved_amount_cents >= 0),
    status VARCHAR(50) NOT NULL DEFAULT 'SUBMITTED',
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_scheme_claims_tenant_code UNIQUE (tenant_id, claim_code),
    CONSTRAINT chk_scheme_claims_approved_le_claim CHECK (approved_amount_cents <= claim_amount_cents)
);

CREATE INDEX IF NOT EXISTS idx_scheme_claims_tenant_status ON scheme_claims(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_scheme_claims_tenant_scheme ON scheme_claims(tenant_id, scheme_id);
CREATE INDEX IF NOT EXISTS idx_scheme_claims_tenant_distributor ON scheme_claims(tenant_id, distributor_id);

ALTER TABLE scheme_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scheme_claims_tenant_isolation ON scheme_claims;
CREATE POLICY scheme_claims_tenant_isolation ON scheme_claims
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
