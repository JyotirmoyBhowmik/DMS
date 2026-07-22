-- Migration V024: Add GoodsReceipt constraints, indexes, RLS policies, and optimistic locking version column

ALTER TABLE IF EXISTS goods_receipts
  ADD COLUMN IF NOT EXISTS receipt_number VARCHAR(255) NOT NULL DEFAULT 'GRN-DEFAULT',
  ADD COLUMN IF NOT EXISTS purchase_order_id VARCHAR(255) NOT NULL DEFAULT 'po-default',
  ADD COLUMN IF NOT EXISTS warehouse_id VARCHAR(255) NOT NULL DEFAULT 'wh-default',
  ADD COLUMN IF NOT EXISTS sku_id VARCHAR(255) NOT NULL DEFAULT 'sku-default',
  ADD COLUMN IF NOT EXISTS received_quantity INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Constraint enforcing positive received quantity
ALTER TABLE IF EXISTS goods_receipts
  DROP CONSTRAINT IF EXISTS chk_goods_receipts_positive_quantity;
ALTER TABLE IF EXISTS goods_receipts
  ADD CONSTRAINT chk_goods_receipts_positive_quantity CHECK (received_quantity > 0);

-- Indexes for performance and common filters
CREATE INDEX IF NOT EXISTS idx_goods_receipts_tenant_status ON goods_receipts (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_po_wh ON goods_receipts (tenant_id, purchase_order_id, warehouse_id);

-- Row-Level Security Policy
ALTER TABLE goods_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS goods_receipts_tenant_isolation_policy ON goods_receipts;
CREATE POLICY goods_receipts_tenant_isolation_policy ON goods_receipts
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));
