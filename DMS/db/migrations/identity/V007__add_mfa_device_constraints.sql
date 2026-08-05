-- Migration V007: Add MFADevice table constraints, indexes, and RLS policies

CREATE TABLE IF NOT EXISTS identity_mfa_devices (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    user_id VARCHAR(128) NOT NULL,
    type VARCHAR(32) NOT NULL,
    secret_encrypted TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_used_at TIMESTAMP WITH TIME ZONE NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_mfa_type CHECK (type IN ('TOTP', 'SMS', 'EMAIL', 'SECURITY_KEY')),
    CONSTRAINT chk_mfa_version_positive CHECK (version >= 1),
    CONSTRAINT uk_mfa_user_type UNIQUE (tenant_id, user_id, type)
);

-- Indexing for performance and RLS
CREATE INDEX IF NOT EXISTS idx_mfa_devices_tenant_id ON identity_mfa_devices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mfa_devices_user_id ON identity_mfa_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_devices_tenant_status ON identity_mfa_devices(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_mfa_devices_type ON identity_mfa_devices(type);

-- Row Level Security Policy
ALTER TABLE identity_mfa_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mfa_devices_tenant_isolation_policy ON identity_mfa_devices;

CREATE POLICY mfa_devices_tenant_isolation_policy ON identity_mfa_devices
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
