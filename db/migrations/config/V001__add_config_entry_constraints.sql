-- Migration V001: Add ConfigEntry table, constraints, composite indexes and RLS policy
-- Domain: Config Service (P4 Integrations)

CREATE TABLE IF NOT EXISTS config_entries (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    config_key VARCHAR(255) NOT NULL,
    config_value TEXT NOT NULL,
    data_type VARCHAR(50) NOT NULL DEFAULT 'STRING',
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    is_encrypted BOOLEAN NOT NULL DEFAULT FALSE,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_config_entries_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'DEPRECATED')),
    CONSTRAINT chk_config_entries_data_type CHECK (data_type IN ('STRING', 'NUMBER', 'BOOLEAN', 'JSON')),
    CONSTRAINT chk_config_entries_version CHECK (version >= 1),
    CONSTRAINT uq_config_entries_tenant_key UNIQUE (tenant_id, config_key)
);

-- Indexes for fast querying & filtering
CREATE INDEX IF NOT EXISTS idx_config_entries_tenant_status ON config_entries(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_config_entries_tenant_key ON config_entries(tenant_id, config_key);
CREATE INDEX IF NOT EXISTS idx_config_entries_created_at ON config_entries(tenant_id, created_at DESC);

-- Row Level Security (RLS) Policy
ALTER TABLE config_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS config_entries_tenant_isolation ON config_entries;

CREATE POLICY config_entries_tenant_isolation ON config_entries
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

/*
-- REVERSIBLE DOWN MIGRATION:
DROP POLICY IF EXISTS config_entries_tenant_isolation ON config_entries;
ALTER TABLE config_entries DISABLE ROW LEVEL SECURITY;
DROP TABLE IF EXISTS config_entries;
*/
