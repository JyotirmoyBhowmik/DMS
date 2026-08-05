-- Migration V001: Add Report table, constraints, composite indexes and RLS policy
-- Domain: Report Service (P4 Integrations)

CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    download_url VARCHAR(1024),
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_reports_status CHECK (status IN ('DRAFT', 'GENERATING', 'COMPLETED', 'FAILED')),
    CONSTRAINT chk_reports_type CHECK (type IN ('SALES', 'INVENTORY', 'FINANCIAL', 'AUDIT', 'CUSTOM')),
    CONSTRAINT chk_reports_version CHECK (version >= 1)
);

-- Indexes for fast querying & filtering
CREATE INDEX IF NOT EXISTS idx_reports_tenant_status ON reports(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_reports_tenant_type ON reports(tenant_id, type);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(tenant_id, created_at DESC);

-- Row Level Security (RLS) Policy
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reports_tenant_isolation ON reports;

CREATE POLICY reports_tenant_isolation ON reports
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

/*
-- REVERSIBLE DOWN MIGRATION:
DROP POLICY IF EXISTS reports_tenant_isolation ON reports;
ALTER TABLE reports DISABLE ROW LEVEL SECURITY;
DROP TABLE IF EXISTS reports;
*/
