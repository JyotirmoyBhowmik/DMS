-- Migration V025: Add PurchaseOrder constraints, indexes, RLS policies, and optimistic locking version column

ALTER TABLE IF EXISTS purchase_orders
  ADD COLUMN IF NOT EXISTS po_number VARCHAR(255) NOT NULL DEFAULT 'PO-DEFAULT',
  ADD COLUMN IF NOT EXISTS supplier_id VARCHAR(255) NOT NULL DEFAULT 'supplier-default',
  ADD COLUMN IF NOT EXISTS warehouse_id VARCHAR(255) NOT NULL DEFAULT 'wh-default',
  ADD COLUMN IF NOT EXISTS total_amount_cents BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Constraint enforcing non-negative total amount
ALTER TABLE IF EXISTS purchase_orders
  DROP CONSTRAINT IF EXISTS chk_purchase_orders_non_negative_amount;
ALTER TABLE IF EXISTS purchase_orders
  ADD CONSTRAINT chk_purchase_orders_non_negative_amount CHECK (total_amount_cents >= 0);

-- Indexes for performance and common filters
CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant_status ON purchase_orders (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_wh ON purchase_orders (tenant_id, supplier_id, warehouse_id);

-- Row-Level Security Policy
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS purchase_orders_tenant_isolation_policy ON purchase_orders;
CREATE POLICY purchase_orders_tenant_isolation_policy ON purchase_orders
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));
