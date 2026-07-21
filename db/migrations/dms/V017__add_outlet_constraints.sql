-- Migration V017: Add Outlet constraints, indexes, RLS policies, and optimistic locking version column

ALTER TABLE IF EXISTS outlets
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS channel_type VARCHAR(30) NOT NULL DEFAULT 'RETAIL',
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS owner_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS owner_phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Indexes for performance and common filters
CREATE INDEX IF NOT EXISTS idx_outlets_tenant_status ON outlets (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_outlets_channel ON outlets (tenant_id, channel_type);

-- Row-Level Security Policy
ALTER TABLE outlets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS outlets_tenant_isolation_policy ON outlets;
CREATE POLICY outlets_tenant_isolation_policy ON outlets
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));
