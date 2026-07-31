-- Migration: V006__add_tenant_constraints.sql
-- Description: Tenants table schema with constraints, indexes, versioning for optimistic locking, and tenant RLS isolation.

CREATE TABLE IF NOT EXISTS identity_tenants (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name VARCHAR(128) NOT NULL,
  code VARCHAR(64) NOT NULL,
  domain VARCHAR(128),
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
  idempotency_key VARCHAR(128),
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_tenant_name UNIQUE (name),
  CONSTRAINT uq_tenant_code UNIQUE (code)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_identity_tenants_status ON identity_tenants(status);
CREATE INDEX IF NOT EXISTS idx_identity_tenants_name ON identity_tenants(name);

-- Version Auto-Incrementing Trigger
CREATE OR REPLACE FUNCTION update_identity_tenants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_identity_tenants_updated_at ON identity_tenants;
CREATE TRIGGER trigger_update_identity_tenants_updated_at
  BEFORE UPDATE ON identity_tenants
  FOR EACH ROW
  EXECUTE FUNCTION update_identity_tenants_updated_at();

-- Row Level Security Policy (Tenant Isolation)
ALTER TABLE identity_tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_identity_tenants ON identity_tenants;
CREATE POLICY tenant_isolation_identity_tenants ON identity_tenants
  FOR ALL
  USING (tenant_id::text = current_setting('app.current_tenant_id', true)::uuid OR id = current_setting('app.current_tenant_id', true)::uuid);

/*
-- Reversible Down Migration
DROP POLICY IF EXISTS tenant_isolation_identity_tenants ON identity_tenants;
DROP TRIGGER IF EXISTS trigger_update_identity_tenants_updated_at ON identity_tenants;
DROP FUNCTION IF EXISTS update_identity_tenants_updated_at();
DROP TABLE IF EXISTS identity_tenants;
*/
