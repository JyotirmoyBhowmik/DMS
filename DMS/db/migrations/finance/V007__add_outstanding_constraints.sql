-- =============================================================================
-- V007: Add Outstanding constraints, composite indexes & RLS policies for finance-service
-- Enforces integrity at DB layer with reversible migration definitions.
-- =============================================================================

BEGIN;

-- 1. Create Outstandings Table
CREATE TABLE IF NOT EXISTS finance_outstandings (
  id                     UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID          NOT NULL,
  distributor_id         UUID          NOT NULL,
  invoice_id             UUID          REFERENCES finance_invoices(id) ON DELETE SET NULL,
  outstanding_reference  VARCHAR(100)  NOT NULL,
  amount_cents           BIGINT        NOT NULL CHECK (amount_cents >= 0),
  due_date               TIMESTAMPTZ,
  status                 VARCHAR(20)   NOT NULL DEFAULT 'OPEN'
                           CHECK (status IN ('OPEN', 'PARTIAL', 'PAID', 'OVERDUE', 'WRITTEN_OFF')),
  idempotency_key        VARCHAR(100),
  version                INTEGER       NOT NULL DEFAULT 1,
  created_at             TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT uq_finance_outstanding_reference UNIQUE (tenant_id, outstanding_reference)
);

-- 2. Indexes for FKs and composite query filters
CREATE INDEX IF NOT EXISTS idx_fin_out_tenant         ON finance_outstandings (tenant_id);
CREATE INDEX IF NOT EXISTS idx_fin_out_tenant_status  ON finance_outstandings (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_fin_out_distributor    ON finance_outstandings (tenant_id, distributor_id);
CREATE INDEX IF NOT EXISTS idx_fin_out_invoice        ON finance_outstandings (tenant_id, invoice_id);

-- 3. Auto-update Trigger
CREATE TRIGGER trg_finance_outstandings_updated_at
  BEFORE UPDATE ON finance_outstandings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. Row Level Security Policies
ALTER TABLE finance_outstandings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_finance_outstandings ON finance_outstandings;
CREATE POLICY tenant_isolation_finance_outstandings ON finance_outstandings
  FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

COMMIT;

-- DOWN MIGRATION (Reversible script reference):
-- BEGIN;
-- DROP POLICY IF EXISTS tenant_isolation_finance_outstandings ON finance_outstandings;
-- DROP TABLE IF EXISTS finance_outstandings CASCADE;
-- COMMIT;
