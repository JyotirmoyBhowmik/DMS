-- =============================================================================
-- V011: Create van_sales table for Sales Force Automation (SFA)
-- Tracks mobile van selling: loading, selling at outlets, returns, reconciliation.
-- Monetary amounts stored as BIGINT in smallest currency unit (paise/cents).
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS van_sales (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID         NOT NULL,
  agent_id            UUID         NOT NULL,
  vehicle_id          UUID         NOT NULL,
  route_id            UUID         NOT NULL,
  date                DATE         NOT NULL,
  loaded_items        JSONB        NOT NULL DEFAULT '[]',
  sold_items          JSONB        NOT NULL DEFAULT '[]',
  returned_items      JSONB        NOT NULL DEFAULT '[]',
  cash_collected      BIGINT       NOT NULL DEFAULT 0 CHECK (cash_collected >= 0),
  cash_currency       VARCHAR(3)   NOT NULL DEFAULT 'INR',
  digital_payments    BIGINT       NOT NULL DEFAULT 0 CHECK (digital_payments >= 0),
  digital_currency    VARCHAR(3)   NOT NULL DEFAULT 'INR',
  status              VARCHAR(20)  NOT NULL DEFAULT 'loading'
                        CHECK (status IN ('loading','in_transit','selling','reconciliation','closed')),
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  version             INTEGER      NOT NULL DEFAULT 1
);

COMMENT ON TABLE van_sales IS 'Mobile van direct selling records with inventory and payment tracking';
COMMENT ON COLUMN van_sales.loaded_items IS 'Array of {skuId, qty, batchNumber} objects loaded onto the van';
COMMENT ON COLUMN van_sales.sold_items IS 'Array of {skuId, qty, unitPrice, outletId} objects sold during route';
COMMENT ON COLUMN van_sales.returned_items IS 'Array of {skuId, qty, reason} objects returned unsold';
COMMENT ON COLUMN van_sales.cash_collected IS 'Total cash collected in smallest currency unit';
COMMENT ON COLUMN van_sales.digital_payments IS 'Total digital payments in smallest currency unit';

-- Tenant-scoped indexes
CREATE INDEX idx_van_sales_tenant     ON van_sales (tenant_id);
CREATE INDEX idx_van_sales_agent      ON van_sales (tenant_id, agent_id);
CREATE INDEX idx_van_sales_vehicle    ON van_sales (tenant_id, vehicle_id);
CREATE INDEX idx_van_sales_route      ON van_sales (tenant_id, route_id);
CREATE INDEX idx_van_sales_date       ON van_sales (tenant_id, date DESC);
CREATE INDEX idx_van_sales_status     ON van_sales (tenant_id, status);
CREATE INDEX idx_van_sales_loaded     ON van_sales USING GIN (loaded_items jsonb_path_ops);
CREATE INDEX idx_van_sales_sold       ON van_sales USING GIN (sold_items jsonb_path_ops);

CREATE TRIGGER van_sales_set_updated_at
  BEFORE UPDATE ON van_sales
  FOR EACH ROW
  EXECUTE FUNCTION trg_set_updated_at();

COMMIT;
