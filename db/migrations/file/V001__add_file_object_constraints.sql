-- Migration V001: Add FileObject table, constraints, composite indexes and RLS policy
-- Domain: File Service (P4 Integrations)

CREATE TABLE IF NOT EXISTS file_objects (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    storage_path VARCHAR(1024) NOT NULL,
    checksum VARCHAR(128) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_file_objects_status CHECK (status IN ('PENDING', 'UPLOADED', 'ARCHIVED', 'DELETED')),
    CONSTRAINT chk_file_objects_size CHECK (size_bytes >= 0),
    CONSTRAINT chk_file_objects_version CHECK (version >= 1)
);

-- Indexes for fast querying & filtering
CREATE INDEX IF NOT EXISTS idx_file_objects_tenant_status ON file_objects(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_file_objects_tenant_filename ON file_objects(tenant_id, filename);
CREATE INDEX IF NOT EXISTS idx_file_objects_created_at ON file_objects(tenant_id, created_at DESC);

-- Row Level Security (RLS) Policy
ALTER TABLE file_objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS file_objects_tenant_isolation ON file_objects;

CREATE POLICY file_objects_tenant_isolation ON file_objects
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

/*
-- REVERSIBLE DOWN MIGRATION:
DROP POLICY IF EXISTS file_objects_tenant_isolation ON file_objects;
ALTER TABLE file_objects DISABLE ROW LEVEL SECURITY;
DROP TABLE IF EXISTS file_objects;
*/
