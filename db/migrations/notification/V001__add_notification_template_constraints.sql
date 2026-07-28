-- Migration V001: Add NotificationTemplate table constraints, indexes, and RLS policies

CREATE TABLE IF NOT EXISTS notification_templates (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    code VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    channel VARCHAR(32) NOT NULL,
    subject VARCHAR(256) NULL,
    body_template TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_notification_channel CHECK (channel IN ('EMAIL', 'SMS', 'PUSH', 'WHATSAPP')),
    CONSTRAINT chk_notification_template_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
    CONSTRAINT chk_notification_template_version CHECK (version >= 1),
    CONSTRAINT uk_notification_template_code UNIQUE (tenant_id, code)
);

-- Indexing for performance and RLS
CREATE INDEX IF NOT EXISTS idx_notification_templates_tenant_id ON notification_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_templates_code ON notification_templates(code);
CREATE INDEX IF NOT EXISTS idx_notification_templates_channel ON notification_templates(channel);
CREATE INDEX IF NOT EXISTS idx_notification_templates_tenant_status ON notification_templates(tenant_id, status);

-- Row Level Security Policy
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_templates_tenant_isolation_policy ON notification_templates;

CREATE POLICY notification_templates_tenant_isolation_policy ON notification_templates
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
