-- =============================================================================
-- V009: Create batches table
-- Tracks product batches with FEFO (First Expiry, First Out) ordering.
-- Supports quarantine, expiry, and recall workflows.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS batches (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID          NOT NULL,
  product_id            UUID          NOT NULL REFERENCES products_skus(id) ON DELETE RESTRICT,
  batch_number          VARCHAR(100)  NOT NULL,
  manufacturing_date    DATE          NOT NULL,
  expiry_date           DATE          NOT NULL,
  quantity              INTEGER       NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  quarantine_quantity   INTEGER       NOT NULL DEFAULT 0 CHECK (quarantine_quantity >= 0),
  status                VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE'
                          CHECK (status IN ('ACTIVE','QUARANTINED','EXPIRED','RECALLED')),
  mfg_lot_number        VARCHAR(100),
  version               INTEGER       NOT NULL DEFAULT 1,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),

  -- Unique batch number per product per tenant
  CONSTRAINT uq_batch_product UNIQUE (tenant_id, product_id, batch_number),
  -- Expiry must be after manufacturing date
  CONSTRAINT chk_expiry_after_mfg CHECK (expiry_date > manufacturing_date)
);

-- Indexes — FEFO ordering uses expiry_date ASC
CREATE INDEX idx_batch_tenant        ON batches (tenant_id);
CREATE INDEX idx_batch_product       ON batches (tenant_id, product_id);
CREATE INDEX idx_batch_fefo          ON batches (tenant_id, product_id, expiry_date ASC) WHERE status = 'ACTIVE';
CREATE INDEX idx_batch_status        ON batches (tenant_id, status);
CREATE INDEX idx_batch_expiry        ON batches (expiry_date);

CREATE TRIGGER trg_batch_updated_at
  BEFORE UPDATE ON batches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
