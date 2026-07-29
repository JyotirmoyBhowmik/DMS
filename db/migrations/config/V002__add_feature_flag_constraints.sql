-- Migration V002: Add FeatureFlag table, constraints, composite indexes and RLS policy
-- Domain: Config Service (P4 Integrations)

CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    flag_key VARCHAR(255) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    strategy VARCHAR(50) NOT NULL DEFAULT 'BOOLEAN',
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    rollout_percentage INT NOT NULL DEFAULT 100,
    target_rules JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_feature_flags_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
    CONSTRAINT chk_feature_flags_strategy CHECK (strategy IN ('BOOLEAN', 'PERCENTAGE', 'GRADUAL')),
    CONSTRAINT chk_feature_flags_rollout CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
    CONSTRAINT chk_feature_flags_version CHECK (version >= 1),
    CONSTRAINT uq_feature_flags_tenant_key UNIQUE (tenant_id, flag_key)
);

-- Indexes for fast querying & filtering
CREATE INDEX IF NOT EXISTS idx_feature_flags_tenant_status ON feature_flags(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_feature_flags_tenant_key ON feature_flags(tenant_id, flag_key);
CREATE INDEX IF NOT EXISTS idx_feature_flags_created_at ON feature_flags(tenant_id, created_at DESC);

-- Row Level Security (RLS) Policy
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feature_flags_tenant_isolation ON feature_flags;

CREATE POLICY feature_flags_tenant_isolation ON feature_flags
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

/*
-- REVERSIBLE DOWN MIGRATION:
DROP POLICY IF EXISTS feature_flags_tenant_isolation ON feature_flags;
ALTER TABLE feature_flags DISABLE ROW LEVEL SECURITY;
DROP TABLE IF EXISTS feature_flags;
*/
