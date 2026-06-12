-- =============================================================================
-- V001: Create schemes table with RLS policy
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS schemes (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID          NOT NULL,
  name          VARCHAR(255)  NOT NULL,
  description   TEXT,
  status        VARCHAR(50)   NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'suspended', 'expired')),
  start_date    DATE          NOT NULL,
  end_date      DATE,
  rules         JSONB         NOT NULL DEFAULT '{}',
  payouts       JSONB         NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  version       INTEGER       NOT NULL DEFAULT 1
);

-- RLS
ALTER TABLE schemes ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_schemes ON schemes
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

-- Trigger: auto-update updated_at on modification
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER schemes_set_updated_at
  BEFORE UPDATE ON schemes
  FOR EACH ROW
  EXECUTE FUNCTION trg_set_updated_at();

-- Indexes
CREATE INDEX idx_schemes_tenant ON schemes (tenant_id);
CREATE INDEX idx_schemes_status ON schemes (tenant_id, status);
CREATE INDEX idx_schemes_dates  ON schemes (start_date, end_date);

COMMIT;
