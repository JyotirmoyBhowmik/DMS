-- Migration V037: Add Scheme constraints, indexes, RLS policies, and optimistic locking version column

CREATE TABLE IF NOT EXISTS schemes (
  id VARCHAR(255) PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(255) NOT NULL,
  scheme_type VARCHAR(50) NOT NULL DEFAULT 'QUANTITY_DISCOUNT',
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_schemes_code UNIQUE (tenant_id, code)
);

-- Indexes for performance and common filters
CREATE INDEX IF NOT EXISTS idx_schemes_tenant_status ON schemes (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_schemes_tenant_code ON schemes (tenant_id, code);

-- Row-Level Security Policy
ALTER TABLE schemes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS schemes_tenant_isolation_policy ON schemes;
CREATE POLICY schemes_tenant_isolation_policy ON schemes
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));
