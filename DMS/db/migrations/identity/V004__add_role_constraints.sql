-- Migration: V004__add_role_constraints.sql
-- Description: Roles table schema with constraints, composite indexes, versioning for optimistic locking, and tenant RLS isolation.

CREATE TABLE IF NOT EXISTS identity_roles (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name VARCHAR(128) NOT NULL,
  description VARCHAR(512),
  is_system BOOLEAN NOT NULL DEFAULT false,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
  idempotency_key VARCHAR(128),
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_role_tenant_name UNIQUE (tenant_id, name)
);

-- Performance Composite Indexes
CREATE INDEX IF NOT EXISTS idx_identity_roles_tenant_status ON identity_roles(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_identity_roles_tenant_name ON identity_roles(tenant_id, name);

-- Version Auto-Incrementing Trigger
CREATE OR REPLACE FUNCTION update_identity_roles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_identity_roles_updated_at ON identity_roles;
CREATE TRIGGER trigger_update_identity_roles_updated_at
  BEFORE UPDATE ON identity_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_identity_roles_updated_at();

-- Row Level Security Policy (Tenant Isolation)
ALTER TABLE identity_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_identity_roles ON identity_roles;
CREATE POLICY tenant_isolation_identity_roles ON identity_roles
  FOR ALL
  USING (tenant_id::text = current_setting('app.current_tenant_id', true)::uuid);

/*
-- Reversible Down Migration
DROP POLICY IF EXISTS tenant_isolation_identity_roles ON identity_roles;
DROP TRIGGER IF EXISTS trigger_update_identity_roles_updated_at ON identity_roles;
DROP FUNCTION IF EXISTS update_identity_roles_updated_at();
DROP TABLE IF EXISTS identity_roles;
*/
