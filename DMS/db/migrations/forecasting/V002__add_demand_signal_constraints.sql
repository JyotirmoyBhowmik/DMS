-- Migration V002: Add DemandSignal table, constraints, composite indexes and RLS policy
-- Domain: Forecasting Service (P5 Hardening)

CREATE TABLE IF NOT EXISTS demand_signals (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    signal_name VARCHAR(255) NOT NULL,
    signal_type VARCHAR(50) NOT NULL DEFAULT 'HISTORICAL_SALES',
    signal_value NUMERIC(15, 4) NOT NULL DEFAULT 0.0,
    confidence_score NUMERIC(5, 2) NOT NULL DEFAULT 1.0,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    source_channel VARCHAR(100) NOT NULL DEFAULT 'SYSTEM',
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_demand_signals_status CHECK (status IN ('PENDING', 'PROCESSED', 'ARCHIVED')),
    CONSTRAINT chk_demand_signals_type CHECK (signal_type IN ('HISTORICAL_SALES', 'PROMOTION', 'SEASONALITY', 'MARKET_TREND')),
    CONSTRAINT chk_demand_signals_confidence CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    CONSTRAINT chk_demand_signals_version CHECK (version >= 1),
    CONSTRAINT uq_demand_signals_tenant_name UNIQUE (tenant_id, signal_name)
);

-- Indexes for fast querying & filtering
CREATE INDEX IF NOT EXISTS idx_demand_signals_tenant_status ON demand_signals(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_demand_signals_tenant_type ON demand_signals(tenant_id, signal_type);
CREATE INDEX IF NOT EXISTS idx_demand_signals_created_at ON demand_signals(tenant_id, created_at DESC);

-- Row Level Security (RLS) Policy
ALTER TABLE demand_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS demand_signals_tenant_isolation ON demand_signals;

CREATE POLICY demand_signals_tenant_isolation ON demand_signals
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

/*
-- REVERSIBLE DOWN MIGRATION:
DROP POLICY IF EXISTS demand_signals_tenant_isolation ON demand_signals;
ALTER TABLE demand_signals DISABLE ROW LEVEL SECURITY;
DROP TABLE IF EXISTS demand_signals;
*/
