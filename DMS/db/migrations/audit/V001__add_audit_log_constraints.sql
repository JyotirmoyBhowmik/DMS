-- Migration V001: Add AuditLog table, constraints, composite indexes and RLS policy
-- Domain: Audit Service (P4 Integrations)

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    actor_id VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    source VARCHAR(50) NOT NULL DEFAULT 'WEB',
    correlation_id VARCHAR(255),
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45),
    status VARCHAR(50) NOT NULL DEFAULT 'SUCCESS',
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_audit_logs_status CHECK (status IN ('SUCCESS', 'FAILURE', 'SUSPICIOUS')),
    CONSTRAINT chk_audit_logs_source CHECK (source IN ('WEB', 'MOBILE', 'API', 'SYSTEM')),
    CONSTRAINT chk_audit_logs_version CHECK (version >= 1)
);

-- Indexes for fast querying & filtering
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_status ON audit_logs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_entity ON audit_logs(tenant_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(tenant_id, actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(tenant_id, created_at DESC);

-- Row Level Security (RLS) Policy
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_tenant_isolation ON audit_logs;

CREATE POLICY audit_logs_tenant_isolation ON audit_logs
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

/*
-- REVERSIBLE DOWN MIGRATION:
DROP POLICY IF EXISTS audit_logs_tenant_isolation ON audit_logs;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;
DROP TABLE IF EXISTS audit_logs;
*/
