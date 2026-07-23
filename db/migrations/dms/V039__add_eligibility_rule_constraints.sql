-- Migration V039: Add EligibilityRule constraints, indexes, RLS policies, and optimistic locking version column

CREATE TABLE IF NOT EXISTS eligibility_rules (
  id VARCHAR(255) PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,
  scheme_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  rule_code VARCHAR(255) NOT NULL,
  rule_type VARCHAR(50) NOT NULL DEFAULT 'MIN_ORDER_VALUE',
  min_order_value_cents BIGINT NOT NULL DEFAULT 0,
  target_value VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_eligibility_rules_code UNIQUE (tenant_id, scheme_id, rule_code)
);

-- Constraints enforcing non-negative min_order_value_cents
ALTER TABLE IF EXISTS eligibility_rules
  DROP CONSTRAINT IF EXISTS chk_eligibility_rules_non_negative_min_order;
ALTER TABLE IF EXISTS eligibility_rules
  ADD CONSTRAINT chk_eligibility_rules_non_negative_min_order CHECK (min_order_value_cents >= 0);

-- Indexes for performance and common filters
CREATE INDEX IF NOT EXISTS idx_eligibility_rules_tenant_status ON eligibility_rules (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_eligibility_rules_tenant_scheme ON eligibility_rules (tenant_id, scheme_id);

-- Row-Level Security Policy
ALTER TABLE eligibility_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS eligibility_rules_tenant_isolation_policy ON eligibility_rules;
CREATE POLICY eligibility_rules_tenant_isolation_policy ON eligibility_rules
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));
