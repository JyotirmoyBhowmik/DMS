-- =============================================================================
-- V003: Add CreditNote constraints, composite indexes & RLS policies for finance-service
-- Enforces integrity at DB layer with reversible migration definitions.
-- =============================================================================

BEGIN;

-- 1. Create Credit Notes Table
CREATE TABLE IF NOT EXISTS finance_credit_notes (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID          NOT NULL,
  distributor_id        UUID          NOT NULL,
  invoice_id            UUID          REFERENCES finance_invoices(id) ON DELETE SET NULL,
  credit_note_number    VARCHAR(50)   NOT NULL,
  amount_cents          BIGINT        NOT NULL CHECK (amount_cents > 0),
  currency              VARCHAR(3)    NOT NULL DEFAULT 'USD',
  reason                VARCHAR(500)  NOT NULL,
  status                VARCHAR(20)   NOT NULL DEFAULT 'DRAFT'
                          CHECK (status IN ('DRAFT', 'APPROVED', 'APPLIED', 'CANCELLED')),
  idempotency_key       VARCHAR(100),
  version               INTEGER       NOT NULL DEFAULT 1,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT uq_finance_credit_note_number UNIQUE (tenant_id, credit_note_number)
);

-- 2. Indexes for FKs and composite query filters
CREATE INDEX IF NOT EXISTS idx_fin_cn_tenant         ON finance_credit_notes (tenant_id);
CREATE INDEX IF NOT EXISTS idx_fin_cn_tenant_status  ON finance_credit_notes (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_fin_cn_distributor    ON finance_credit_notes (tenant_id, distributor_id);
CREATE INDEX IF NOT EXISTS idx_fin_cn_invoice        ON finance_credit_notes (tenant_id, invoice_id);

-- 3. Auto-update Trigger
CREATE TRIGGER trg_finance_credit_notes_updated_at
  BEFORE UPDATE ON finance_credit_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. Row Level Security Policies
ALTER TABLE finance_credit_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_finance_credit_notes ON finance_credit_notes;
CREATE POLICY tenant_isolation_finance_credit_notes ON finance_credit_notes
  FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

COMMIT;

-- DOWN MIGRATION (Reversible script reference):
-- BEGIN;
-- DROP POLICY IF EXISTS tenant_isolation_finance_credit_notes ON finance_credit_notes;
-- DROP TABLE IF EXISTS finance_credit_notes CASCADE;
-- COMMIT;
