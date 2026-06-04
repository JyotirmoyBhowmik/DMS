-- =============================================================================
-- V007: Create stock_transfers and stock_transfer_items tables
-- Manages inter-warehouse stock movements with approval workflow.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS stock_transfers (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID          NOT NULL,
  from_warehouse_id     VARCHAR(100)  NOT NULL,
  to_warehouse_id       VARCHAR(100)  NOT NULL,
  status                VARCHAR(20)   NOT NULL DEFAULT 'REQUESTED'
                          CHECK (status IN ('REQUESTED','APPROVED','IN_TRANSIT','RECEIVED','CLOSED','REJECTED')),
  requested_by          UUID          NOT NULL,
  approved_by           UUID,
  transfer_date         TIMESTAMPTZ,
  received_at           TIMESTAMPTZ,
  received_by           UUID,
  discrepancy_notes     TEXT,
  version               INTEGER       NOT NULL DEFAULT 1,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),

  -- Cannot transfer to same warehouse
  CONSTRAINT chk_different_warehouses CHECK (from_warehouse_id <> to_warehouse_id)
);

CREATE TABLE IF NOT EXISTS stock_transfer_items (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id           UUID          NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  product_id            UUID          NOT NULL REFERENCES products_skus(id) ON DELETE RESTRICT,
  batch_number          VARCHAR(100)  NOT NULL,
  quantity              INTEGER       NOT NULL CHECK (quantity > 0),
  expiry_date           DATE          NOT NULL,
  received_quantity     INTEGER,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_st_tenant           ON stock_transfers (tenant_id);
CREATE INDEX idx_st_status           ON stock_transfers (tenant_id, status);
CREATE INDEX idx_st_from_wh          ON stock_transfers (tenant_id, from_warehouse_id);
CREATE INDEX idx_st_to_wh            ON stock_transfers (tenant_id, to_warehouse_id);
CREATE INDEX idx_sti_transfer        ON stock_transfer_items (transfer_id);

CREATE TRIGGER trg_st_updated_at
  BEFORE UPDATE ON stock_transfers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
