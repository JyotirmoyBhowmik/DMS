-- Migration V001: Add Recommendation table, constraints, composite indexes and RLS policy
-- Domain: Recommendation Service (P5 Hardening)

CREATE TABLE IF NOT EXISTS recommendations (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    target_type VARCHAR(50) NOT NULL DEFAULT 'OUTLET',
    target_id UUID NOT NULL,
    recommendation_type VARCHAR(50) NOT NULL DEFAULT 'CROSS_SELL',
    score NUMERIC(5, 4) NOT NULL DEFAULT 0.5000,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    payload JSONB DEFAULT '{}'::jsonb,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_recommendations_status CHECK (status IN ('DRAFT', 'ACTIVE', 'APPLIED', 'DISMISSED', 'EXPIRED')),
    CONSTRAINT chk_recommendations_target CHECK (target_type IN ('OUTLET', 'PRODUCT', 'DISTRIBUTOR')),
    CONSTRAINT chk_recommendations_type CHECK (recommendation_type IN ('CROSS_SELL', 'UP_SELL', 'INVENTORY_REPLENISHMENT', 'PRICE_OPTIMIZATION')),
    CONSTRAINT chk_recommendations_score CHECK (score >= 0.0 AND score <= 1.0),
    CONSTRAINT chk_recommendations_version CHECK (version >= 1),
    CONSTRAINT uq_recommendations_tenant_title UNIQUE (tenant_id, title)
);

-- Indexes for fast querying & filtering
CREATE INDEX IF NOT EXISTS idx_recommendations_tenant_status ON recommendations(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_recommendations_tenant_target ON recommendations(tenant_id, target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_created_at ON recommendations(tenant_id, created_at DESC);

-- Row Level Security (RLS) Policy
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS recommendations_tenant_isolation ON recommendations;

CREATE POLICY recommendations_tenant_isolation ON recommendations
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

/*
-- REVERSIBLE DOWN MIGRATION:
DROP POLICY IF EXISTS recommendations_tenant_isolation ON recommendations;
ALTER TABLE recommendations DISABLE ROW LEVEL SECURITY;
DROP TABLE IF EXISTS recommendations;
*/
