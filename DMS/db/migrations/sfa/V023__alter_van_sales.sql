-- =============================================================================
-- V023: Alter van_sales table to add constraints, indexes and enable RLS
-- =============================================================================

BEGIN;

-- 1. Add Foreign Key constraints
ALTER TABLE van_sales
  ADD CONSTRAINT fk_van_sales_agent
  FOREIGN KEY (agent_id) REFERENCES agents(id)
  ON DELETE CASCADE;

ALTER TABLE van_sales
  ADD CONSTRAINT fk_van_sales_route
  FOREIGN KEY (route_id) REFERENCES beat_routes(id)
  ON DELETE CASCADE;

-- 2. Add Unique constraint for agent and date per tenant
ALTER TABLE van_sales
  ADD CONSTRAINT uq_van_sales_agent_date
  UNIQUE (tenant_id, agent_id, date);

-- 3. Enable Row-Level Security
ALTER TABLE van_sales ENABLE ROW LEVEL SECURITY;

-- 4. Attach tenant isolation policy
DROP POLICY IF EXISTS van_sales_tenant_isolation ON van_sales;
CREATE POLICY van_sales_tenant_isolation ON van_sales
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

COMMIT;
