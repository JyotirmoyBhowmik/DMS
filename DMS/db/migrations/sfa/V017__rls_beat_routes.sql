-- =============================================================================
-- V017: Enable Row-Level Security (RLS) on beat_routes table
-- Enforces strict tenant isolation.
-- =============================================================================

ALTER TABLE beat_routes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS beat_routes_tenant_isolation ON beat_routes;

CREATE POLICY beat_routes_tenant_isolation ON beat_routes
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
