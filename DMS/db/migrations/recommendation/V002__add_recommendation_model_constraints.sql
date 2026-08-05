-- Migration V002: Add RecommendationModel table, constraints, composite indexes and RLS policy
-- Domain: Recommendation Service (P5 Hardening)

CREATE TABLE IF NOT EXISTS recommendation_models (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    model_name VARCHAR(255) NOT NULL,
    model_type VARCHAR(50) NOT NULL DEFAULT 'COLLABORATIVE_FILTERING',
    precision_at_k NUMERIC(5, 4),
    recall_at_k NUMERIC(5, 4),
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    hyperparameters JSONB DEFAULT '{}'::jsonb,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_recommendation_models_status CHECK (status IN ('DRAFT', 'TRAINING', 'ACTIVE', 'RETIRED')),
    CONSTRAINT chk_recommendation_models_type CHECK (model_type IN ('COLLABORATIVE_FILTERING', 'CONTENT_BASED', 'RULE_BASED', 'HYBRID')),
    CONSTRAINT chk_recommendation_models_precision CHECK (precision_at_k IS NULL OR (precision_at_k >= 0.0 AND precision_at_k <= 1.0)),
    CONSTRAINT chk_recommendation_models_recall CHECK (recall_at_k IS NULL OR (recall_at_k >= 0.0 AND recall_at_k <= 1.0)),
    CONSTRAINT chk_recommendation_models_version CHECK (version >= 1),
    CONSTRAINT uq_recommendation_models_tenant_name UNIQUE (tenant_id, model_name)
);

-- Indexes for fast querying & filtering
CREATE INDEX IF NOT EXISTS idx_recommendation_models_tenant_status ON recommendation_models(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_recommendation_models_tenant_type ON recommendation_models(tenant_id, model_type);
CREATE INDEX IF NOT EXISTS idx_recommendation_models_created_at ON recommendation_models(tenant_id, created_at DESC);

-- Row Level Security (RLS) Policy
ALTER TABLE recommendation_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS recommendation_models_tenant_isolation ON recommendation_models;

CREATE POLICY recommendation_models_tenant_isolation ON recommendation_models
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

/*
-- REVERSIBLE DOWN MIGRATION:
DROP POLICY IF EXISTS recommendation_models_tenant_isolation ON recommendation_models;
ALTER TABLE recommendation_models DISABLE ROW LEVEL SECURITY;
DROP TABLE IF EXISTS recommendation_models;
*/
