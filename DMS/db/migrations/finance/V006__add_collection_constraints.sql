-- =============================================================================
-- V006: Add Collection constraints, composite indexes & RLS policies for finance-service
-- Enforces integrity at DB layer with reversible migration definitions.
-- =============================================================================

BEGIN;

-- 1. Create Collections Table
CREATE TABLE IF NOT EXISTS finance_collections (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID          NOT NULL,
  distributor_id        UUID          NOT NULL,
  invoice_id            UUID          REFERENCES finance_invoices(id) ON DELETE SET NULL,
  collection_reference  VARCHAR(100)  NOT NULL,
  amount_cents          BIGINT        NOT NULL CHECK (amount_cents > 0),
  collection_mode       VARCHAR(50)   NOT NULL DEFAULT 'CASH',
  currency              VARCHAR(3)    NOT NULL DEFAULT 'USD',
  status                VARCHAR(20)   NOT NULL DEFAULT 'DRAFT'
                          CHECK (status IN ('DRAFT', 'PENDING', 'COLLECTED', 'FAILED', 'CANCELLED')),
  idempotency_key       VARCHAR(100),
  version               INTEGER       NOT NULL DEFAULT 1,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT uq_finance_collection_reference UNIQUE (tenant_id, collection_reference)
);

-- 2. Indexes for FKs and composite query filters
CREATE INDEX IF NOT EXISTS idx_fin_col_tenant         ON finance_collections (tenant_id);
CREATE INDEX IF NOT EXISTS idx_fin_col_tenant_status  ON finance_collections (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_fin_col_distributor    ON finance_collections (tenant_id, distributor_id);
CREATE INDEX IF NOT EXISTS idx_fin_col_invoice        ON finance_collections (tenant_id, invoice_id);

-- 3. Auto-update Trigger
CREATE TRIGGER trg_finance_collections_updated_at
  BEFORE UPDATE ON finance_collections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. Row Level Security Policies
ALTER TABLE finance_collections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_finance_collections ON finance_collections;
CREATE POLICY tenant_isolation_finance_collections ON finance_collections
  FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

COMMIT;

-- DOWN MIGRATION (Reversible script reference):
-- BEGIN;
-- DROP POLICY IF EXISTS tenant_isolation_finance_collections ON finance_collections;
-- DROP TABLE IF EXISTS finance_collections CASCADE;
-- COMMIT;
