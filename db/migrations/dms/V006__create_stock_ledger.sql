-- =============================================================================
-- V006: Create stock_ledger table
-- Append-only audit trail for all stock movements.
-- Entries are IMMUTABLE — no UPDATE or DELETE permitted by application.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS stock_ledger (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID          NOT NULL,
  product_id            UUID          NOT NULL REFERENCES products_skus(id) ON DELETE RESTRICT,
  warehouse_id          VARCHAR(100)  NOT NULL,
  batch_number          VARCHAR(100)  NOT NULL,
  transaction_type      VARCHAR(20)   NOT NULL
                          CHECK (transaction_type IN ('INWARD','OUTWARD','ADJUSTMENT','TRANSFER','RETURN','WRITE_OFF')),
  quantity              INTEGER       NOT NULL,
  running_balance       INTEGER       NOT NULL CHECK (running_balance >= 0),
  reference_id          UUID,
  reference_type        VARCHAR(20)
                          CHECK (reference_type IS NULL OR reference_type IN ('ORDER','TRANSFER','RETURN','MANUAL')),
  created_by            UUID          NOT NULL,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now()
  -- NOTE: No updated_at — entries are immutable
);

-- Indexes for querying stock history
CREATE INDEX idx_sl_tenant           ON stock_ledger (tenant_id);
CREATE INDEX idx_sl_product          ON stock_ledger (tenant_id, product_id, warehouse_id);
CREATE INDEX idx_sl_batch            ON stock_ledger (tenant_id, product_id, batch_number);
CREATE INDEX idx_sl_created          ON stock_ledger (created_at);
CREATE INDEX idx_sl_ref              ON stock_ledger (reference_id) WHERE reference_id IS NOT NULL;
CREATE INDEX idx_sl_type             ON stock_ledger (tenant_id, transaction_type);

COMMIT;
