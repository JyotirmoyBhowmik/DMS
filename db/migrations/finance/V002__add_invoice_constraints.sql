-- =============================================================================
-- V002: Add Invoice constraints, composite indexes & RLS policies for finance-service
-- Enforces integrity at DB layer with reversible migration definitions.
-- =============================================================================

BEGIN;

-- 1. Create Invoices Table if not exists
CREATE TABLE IF NOT EXISTS finance_invoices (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID          NOT NULL,
  distributor_id        UUID          NOT NULL,
  order_id              UUID,
  invoice_number        VARCHAR(50)   NOT NULL,
  gross_amount_cents    BIGINT        NOT NULL DEFAULT 0 CHECK (gross_amount_cents >= 0),
  discount_amount_cents BIGINT        NOT NULL DEFAULT 0 CHECK (discount_amount_cents >= 0),
  tax_amount_cents      BIGINT        NOT NULL DEFAULT 0 CHECK (tax_amount_cents >= 0),
  net_amount_cents      BIGINT        NOT NULL DEFAULT 0 CHECK (net_amount_cents >= 0),
  currency              VARCHAR(3)    NOT NULL DEFAULT 'USD',
  status                VARCHAR(20)   NOT NULL DEFAULT 'DRAFT'
                          CHECK (status IN ('DRAFT', 'ISSUED', 'PAID', 'CANCELLED', 'CREDIT_NOTE')),
  due_date              DATE          NOT NULL,
  paid_at               TIMESTAMPTZ,
  idempotency_key       VARCHAR(100),
  version               INTEGER       NOT NULL DEFAULT 1,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT uq_finance_invoice_number UNIQUE (tenant_id, invoice_number)
);

-- 2. Create Invoice Items Table if not exists
CREATE TABLE IF NOT EXISTS finance_invoice_items (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID          NOT NULL,
  invoice_id            UUID          NOT NULL REFERENCES finance_invoices(id) ON DELETE CASCADE,
  product_id            UUID          NOT NULL,
  description           VARCHAR(500)  NOT NULL,
  quantity              INTEGER       NOT NULL CHECK (quantity > 0),
  unit_price_cents      BIGINT        NOT NULL CHECK (unit_price_cents >= 0),
  total_amount_cents    BIGINT        NOT NULL CHECK (total_amount_cents >= 0),
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- 3. Composite & FK Indexes
CREATE INDEX IF NOT EXISTS idx_fin_inv_tenant         ON finance_invoices (tenant_id);
CREATE INDEX IF NOT EXISTS idx_fin_inv_tenant_status  ON finance_invoices (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_fin_inv_distributor    ON finance_invoices (tenant_id, distributor_id);
CREATE INDEX IF NOT EXISTS idx_fin_inv_due_date       ON finance_invoices (tenant_id, due_date);
CREATE INDEX IF NOT EXISTS idx_fin_inv_items_invoice  ON finance_invoice_items (tenant_id, invoice_id);

-- 4. Auto-update Trigger
CREATE TRIGGER trg_finance_invoices_updated_at
  BEFORE UPDATE ON finance_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. Row Level Security Policies
ALTER TABLE finance_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_finance_invoices ON finance_invoices;
CREATE POLICY tenant_isolation_finance_invoices ON finance_invoices
  FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

ALTER TABLE finance_invoice_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_finance_invoice_items ON finance_invoice_items;
CREATE POLICY tenant_isolation_finance_invoice_items ON finance_invoice_items
  FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

COMMIT;

-- DOWN MIGRATION (Reversible script reference):
-- BEGIN;
-- DROP POLICY IF EXISTS tenant_isolation_finance_invoice_items ON finance_invoice_items;
-- DROP POLICY IF EXISTS tenant_isolation_finance_invoices ON finance_invoices;
-- DROP TABLE IF EXISTS finance_invoice_items CASCADE;
-- DROP TABLE IF EXISTS finance_invoices CASCADE;
-- COMMIT;
