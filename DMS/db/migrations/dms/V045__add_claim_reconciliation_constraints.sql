-- Migration: Add ClaimReconciliation Table, Indexes, Constraints and RLS Policy
-- Version: V045

CREATE TABLE IF NOT EXISTS claim_reconciliations (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    reconciliation_code VARCHAR(100) NOT NULL,
    distributor_id UUID NOT NULL,
    total_claimed_cents BIGINT NOT NULL CHECK (total_claimed_cents >= 0),
    total_settled_cents BIGINT NOT NULL DEFAULT 0 CHECK (total_settled_cents >= 0),
    discrepancy_cents BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_claim_reconciliations_tenant_code UNIQUE (tenant_id, reconciliation_code)
);

CREATE INDEX IF NOT EXISTS idx_claim_reconciliations_tenant_status ON claim_reconciliations(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_claim_reconciliations_tenant_distributor ON claim_reconciliations(tenant_id, distributor_id);

ALTER TABLE claim_reconciliations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS claim_reconciliations_tenant_isolation ON claim_reconciliations;
CREATE POLICY claim_reconciliations_tenant_isolation ON claim_reconciliations
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
