-- Migration: V003__add_user_constraints.sql
-- Description: Users table schema with constraints, composite indexes, versioning for optimistic locking, and tenant RLS isolation.

CREATE TABLE IF NOT EXISTS identity_users (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(128),
  last_name VARCHAR(128),
  roles VARCHAR(64)[] NOT NULL DEFAULT ARRAY['user'],
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'LOCKED')),
  idempotency_key VARCHAR(128),
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMPTZ,
  CONSTRAINT uq_user_tenant_email UNIQUE (tenant_id, email)
);

-- Performance Composite Indexes
CREATE INDEX IF NOT EXISTS idx_identity_users_tenant_status ON identity_users(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_identity_users_tenant_email ON identity_users(tenant_id, email);

-- Version Auto-Incrementing Trigger
CREATE OR REPLACE FUNCTION update_identity_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_identity_users_updated_at ON identity_users;
CREATE TRIGGER trigger_update_identity_users_updated_at
  BEFORE UPDATE ON identity_users
  FOR EACH ROW
  EXECUTE FUNCTION update_identity_users_updated_at();

-- Row Level Security Policy (Tenant Isolation)
ALTER TABLE identity_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_identity_users ON identity_users;
CREATE POLICY tenant_isolation_identity_users ON identity_users
  FOR ALL
  USING (tenant_id::text = current_setting('app.current_tenant_id', true)::uuid);

/*
-- Reversible Down Migration
DROP POLICY IF EXISTS tenant_isolation_identity_users ON identity_users;
DROP TRIGGER IF EXISTS trigger_update_identity_users_updated_at ON identity_users;
DROP FUNCTION IF EXISTS update_identity_users_updated_at();
DROP TABLE IF EXISTS identity_users;
*/
