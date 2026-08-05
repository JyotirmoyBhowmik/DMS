-- Migration: Add Settlement Table, Indexes, Constraints and RLS Policy
-- Version: V046

CREATE TABLE IF NOT EXISTS settlements (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    settlement_code VARCHAR(100) NOT NULL,
    claim_id UUID NOT NULL,
    distributor_id UUID NOT NULL,
    amount_cents BIGINT NOT NULL CHECK (amount_cents >= 0),
    payment_reference VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'INITIATED',
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_settlements_tenant_code UNIQUE (tenant_id, settlement_code)
);

CREATE INDEX IF NOT EXISTS idx_settlements_tenant_status ON settlements(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_settlements_tenant_claim ON settlements(tenant_id, claim_id);
CREATE INDEX IF NOT EXISTS idx_settlements_tenant_distributor ON settlements(tenant_id, distributor_id);

ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS settlements_tenant_isolation ON settlements;
CREATE POLICY settlements_tenant_isolation ON settlements
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
