-- Migration V001: Add ForecastModel table, constraints, composite indexes and RLS policy
-- Domain: Forecasting Service (P5 Hardening)

CREATE TABLE IF NOT EXISTS forecast_models (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    model_name VARCHAR(255) NOT NULL,
    algorithm VARCHAR(50) NOT NULL DEFAULT 'ARIMA',
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    accuracy_mape NUMERIC(5, 2) DEFAULT NULL,
    accuracy_rmse NUMERIC(10, 2) DEFAULT NULL,
    hyperparameters JSONB DEFAULT '{}'::jsonb,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_forecast_models_status CHECK (status IN ('DRAFT', 'TRAINING', 'ACTIVE', 'RETIRED')),
    CONSTRAINT chk_forecast_models_algorithm CHECK (algorithm IN ('ARIMA', 'PROPHET', 'EXPONENTIAL_SMOOTHING', 'NEURAL_NETWORK')),
    CONSTRAINT chk_forecast_models_version CHECK (version >= 1),
    CONSTRAINT uq_forecast_models_tenant_name UNIQUE (tenant_id, model_name)
);

-- Indexes for fast querying & filtering
CREATE INDEX IF NOT EXISTS idx_forecast_models_tenant_status ON forecast_models(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_forecast_models_tenant_algo ON forecast_models(tenant_id, algorithm);
CREATE INDEX IF NOT EXISTS idx_forecast_models_created_at ON forecast_models(tenant_id, created_at DESC);

-- Row Level Security (RLS) Policy
ALTER TABLE forecast_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS forecast_models_tenant_isolation ON forecast_models;

CREATE POLICY forecast_models_tenant_isolation ON forecast_models
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

/*
-- REVERSIBLE DOWN MIGRATION:
DROP POLICY IF EXISTS forecast_models_tenant_isolation ON forecast_models;
ALTER TABLE forecast_models DISABLE ROW LEVEL SECURITY;
DROP TABLE IF EXISTS forecast_models;
*/
