-- Migration V036: Add TaxRule constraints, indexes, RLS policies, and optimistic locking version column

CREATE TABLE IF NOT EXISTS tax_rules (
  id VARCHAR(255) PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  tax_code VARCHAR(100) NOT NULL,
  rate_percentage NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_tax_rules_code UNIQUE (tenant_id, tax_code)
);

-- Constraints enforcing non-negative rate_percentage
ALTER TABLE IF EXISTS tax_rules
  DROP CONSTRAINT IF EXISTS chk_tax_rules_non_negative_rate;
ALTER TABLE IF EXISTS tax_rules
  ADD CONSTRAINT chk_tax_rules_non_negative_rate CHECK (rate_percentage >= 0);

-- Indexes for performance and common filters
CREATE INDEX IF NOT EXISTS idx_tax_rules_tenant_status ON tax_rules (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_tax_rules_tenant_code ON tax_rules (tenant_id, tax_code);

-- Row-Level Security Policy
ALTER TABLE tax_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tax_rules_tenant_isolation_policy ON tax_rules;
CREATE POLICY tax_rules_tenant_isolation_policy ON tax_rules
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));
