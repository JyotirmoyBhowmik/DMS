-- Migration V040: Add SchemeBudget constraints, indexes, RLS policies, and optimistic locking version column

CREATE TABLE IF NOT EXISTS scheme_budgets (
  id VARCHAR(255) PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,
  scheme_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  budget_code VARCHAR(255) NOT NULL,
  total_allocated_cents BIGINT NOT NULL DEFAULT 0,
  utilized_cents BIGINT NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_scheme_budgets_code UNIQUE (tenant_id, scheme_id, budget_code)
);

-- Constraints enforcing financial invariants: non-negative allocated cents & utilized <= allocated
ALTER TABLE IF EXISTS scheme_budgets
  DROP CONSTRAINT IF EXISTS chk_scheme_budgets_non_negative_allocated;
ALTER TABLE IF EXISTS scheme_budgets
  ADD CONSTRAINT chk_scheme_budgets_non_negative_allocated CHECK (total_allocated_cents >= 0 AND utilized_cents >= 0 AND utilized_cents <= total_allocated_cents);

-- Indexes for performance and common filters
CREATE INDEX IF NOT EXISTS idx_scheme_budgets_tenant_status ON scheme_budgets (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_scheme_budgets_tenant_scheme ON scheme_budgets (tenant_id, scheme_id);

-- Row-Level Security Policy
ALTER TABLE scheme_budgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scheme_budgets_tenant_isolation_policy ON scheme_budgets;
CREATE POLICY scheme_budgets_tenant_isolation_policy ON scheme_budgets
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));
