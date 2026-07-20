-- =============================================================================
-- V024: Alter delivery_confirmations table to add constraints, indexes and enable RLS
-- =============================================================================

BEGIN;

-- 1. Add Foreign Key constraint to orders
ALTER TABLE delivery_confirmations
  ADD CONSTRAINT fk_delivery_confirmations_order
  FOREIGN KEY (order_id) REFERENCES orders(id)
  ON DELETE CASCADE;

-- 2. Add CHECK constraints for status, latitude, and longitude
ALTER TABLE delivery_confirmations
  ADD CONSTRAINT chk_delivery_confirmations_status
  CHECK (status IN ('FULL', 'PARTIAL', 'REJECTED'));

ALTER TABLE delivery_confirmations
  ADD CONSTRAINT chk_delivery_confirmations_gps_lat
  CHECK (gps_lat BETWEEN -90.0 AND 90.0);

ALTER TABLE delivery_confirmations
  ADD CONSTRAINT chk_delivery_confirmations_gps_lon
  CHECK (gps_lon BETWEEN -180.0 AND 180.0);

-- 3. Add Composite Index for tenant_id and status
CREATE INDEX IF NOT EXISTS idx_delivery_confirmations_tenant_status 
  ON delivery_confirmations (tenant_id, status);

-- 4. Enable Row-Level Security
ALTER TABLE delivery_confirmations ENABLE ROW LEVEL SECURITY;

-- 5. Attach tenant isolation policy
DROP POLICY IF EXISTS delivery_confirmations_tenant_isolation ON delivery_confirmations;
CREATE POLICY delivery_confirmations_tenant_isolation ON delivery_confirmations
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

COMMIT;
