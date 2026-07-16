-- =============================================================================
-- V016: Enable Row Level Security (RLS) on order_approvals table
-- Enforces tenant isolation for order approval workflows.
-- =============================================================================

BEGIN;

ALTER TABLE order_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_order_approvals ON order_approvals;

CREATE POLICY tenant_isolation_order_approvals ON order_approvals
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

COMMIT;
