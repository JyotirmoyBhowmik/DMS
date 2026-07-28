-- V002__add_notification_constraints.sql
-- Creates notifications table with DB-level constraints, indexes, RLS, and optimistic locking

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    template_id UUID REFERENCES notification_templates(id) ON DELETE SET NULL,
    recipient VARCHAR(255) NOT NULL,
    channel VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'QUEUED',
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_notification_recipient_not_empty CHECK (length(trim(recipient)) > 0),
    CONSTRAINT chk_notification_channel CHECK (channel IN ('EMAIL', 'SMS', 'PUSH', 'WHATSAPP')),
    CONSTRAINT chk_notification_status CHECK (status IN ('QUEUED', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED')),
    CONSTRAINT chk_notification_version CHECK (version >= 1)
);

-- Indexes for FK, status filtering, and created_at ordering
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_id ON notifications (tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_template_id ON notifications (template_id);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_status ON notifications (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications (created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policy for multi-tenant isolation
DROP POLICY IF EXISTS notifications_tenant_isolation ON notifications;
CREATE POLICY notifications_tenant_isolation ON notifications
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- DOWN MIGRATION (for rollback validation):
-- DROP POLICY IF EXISTS notifications_tenant_isolation ON notifications;
-- ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
-- DROP TABLE IF EXISTS notifications CASCADE;
