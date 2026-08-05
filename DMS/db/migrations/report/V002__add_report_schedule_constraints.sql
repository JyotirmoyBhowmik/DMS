-- Migration V002: Add ReportSchedule table, constraints, composite indexes and RLS policy
-- Domain: Report Service (P4 Integrations)

CREATE TABLE IF NOT EXISTS report_schedules (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    report_name VARCHAR(255) NOT NULL,
    cron_expression VARCHAR(100) NOT NULL,
    frequency VARCHAR(50) NOT NULL DEFAULT 'DAILY',
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    next_run_at TIMESTAMPTZ,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_schedules_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'PAUSED')),
    CONSTRAINT chk_schedules_frequency CHECK (frequency IN ('DAILY', 'WEEKLY', 'MONTHLY', 'CRON')),
    CONSTRAINT chk_schedules_version CHECK (version >= 1)
);

-- Indexes for fast querying & filtering
CREATE INDEX IF NOT EXISTS idx_report_schedules_tenant_status ON report_schedules(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_report_schedules_next_run ON report_schedules(tenant_id, next_run_at);
CREATE INDEX IF NOT EXISTS idx_report_schedules_created_at ON report_schedules(tenant_id, created_at DESC);

-- Row Level Security (RLS) Policy
ALTER TABLE report_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS report_schedules_tenant_isolation ON report_schedules;

CREATE POLICY report_schedules_tenant_isolation ON report_schedules
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

/*
-- REVERSIBLE DOWN MIGRATION:
DROP POLICY IF EXISTS report_schedules_tenant_isolation ON report_schedules;
ALTER TABLE report_schedules DISABLE ROW LEVEL SECURITY;
DROP TABLE IF EXISTS report_schedules;
*/
