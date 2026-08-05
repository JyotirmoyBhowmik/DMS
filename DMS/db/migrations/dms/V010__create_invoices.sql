-- =============================================================================
-- V010: Create invoices and invoice_items tables
-- GST-compliant invoicing with CGST/SGST/IGST breakdowns.
-- All monetary values stored as BIGINT (paise/cents).
-- =============================================================================

BEGIN;

-- Sequence for auto-generated invoice numbers
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1 INCREMENT 1;

CREATE TABLE IF NOT EXISTS invoices (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID          NOT NULL,
  distributor_id        UUID          NOT NULL REFERENCES distributors(id) ON DELETE RESTRICT,
  order_id              UUID,
  invoice_number        VARCHAR(50)   NOT NULL,
  gross_amount          BIGINT        NOT NULL DEFAULT 0 CHECK (gross_amount >= 0),
  discount_amount       BIGINT        NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  taxable_amount        BIGINT        NOT NULL DEFAULT 0 CHECK (taxable_amount >= 0),
  cgst                  BIGINT        NOT NULL DEFAULT 0 CHECK (cgst >= 0),
  sgst                  BIGINT        NOT NULL DEFAULT 0 CHECK (sgst >= 0),
  igst                  BIGINT        NOT NULL DEFAULT 0 CHECK (igst >= 0),
  total_tax             BIGINT        NOT NULL DEFAULT 0 CHECK (total_tax >= 0),
  net_amount            BIGINT        NOT NULL DEFAULT 0 CHECK (net_amount >= 0),
  currency              VARCHAR(3)    NOT NULL DEFAULT 'INR',
  status                VARCHAR(20)   NOT NULL DEFAULT 'DRAFT'
                          CHECK (status IN ('DRAFT','ISSUED','PAID','CANCELLED','CREDIT_NOTE')),
  due_date              DATE          NOT NULL,
  paid_at               TIMESTAMPTZ,
  e_invoice_irn         VARCHAR(256),
  e_way_bill_number     VARCHAR(50),
  version               INTEGER       NOT NULL DEFAULT 1,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT uq_invoice_number UNIQUE (tenant_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id            UUID          NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id            UUID          NOT NULL REFERENCES products_skus(id) ON DELETE RESTRICT,
  description           VARCHAR(500),
  hsn_code              VARCHAR(20),
  quantity              INTEGER       NOT NULL CHECK (quantity > 0),
  unit_price            BIGINT        NOT NULL CHECK (unit_price >= 0),
  discount_amount       BIGINT        NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  taxable_amount        BIGINT        NOT NULL CHECK (taxable_amount >= 0),
  tax_rate_pct          NUMERIC(5,2)  NOT NULL DEFAULT 18.00,
  tax_amount            BIGINT        NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount          BIGINT        NOT NULL CHECK (total_amount >= 0),
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_inv_tenant          ON invoices (tenant_id);
CREATE INDEX idx_inv_distributor     ON invoices (tenant_id, distributor_id);
CREATE INDEX idx_inv_status          ON invoices (tenant_id, status);
CREATE INDEX idx_inv_due_date        ON invoices (due_date);
CREATE INDEX idx_inv_order           ON invoices (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX idx_inv_items_invoice   ON invoice_items (invoice_id);

CREATE TRIGGER trg_inv_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
