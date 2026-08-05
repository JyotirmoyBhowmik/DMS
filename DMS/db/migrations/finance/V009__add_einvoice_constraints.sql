-- Migration: V009__add_einvoice_constraints.sql
-- Description: eInvoice table schema with constraints, composite indexes, versioning for optimistic locking, and tenant RLS isolation.

CREATE TABLE IF NOT EXISTS finance_einvoices (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  invoice_id UUID NOT NULL,
  irn VARCHAR(128) NOT NULL,
  qr_code TEXT,
  acknowledgement_number VARCHAR(64),
  acknowledgement_date TIMESTAMPTZ,
  tax_amount_cents BIGINT NOT NULL DEFAULT 0 CHECK (tax_amount_cents >= 0),
  total_amount_cents BIGINT NOT NULL DEFAULT 0 CHECK (total_amount_cents >= 0),
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'GENERATED', 'CANCELLED', 'FAILED')),
  idempotency_key VARCHAR(128),
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_einvoice_tenant_irn UNIQUE (tenant_id, irn)
);

-- Performance Composite Indexes
CREATE INDEX IF NOT EXISTS idx_einvoices_tenant_status ON finance_einvoices(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_einvoices_invoice ON finance_einvoices(tenant_id, invoice_id);

-- Version Auto-Incrementing Trigger
CREATE OR REPLACE FUNCTION update_finance_einvoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_finance_einvoices_updated_at ON finance_einvoices;
CREATE TRIGGER trigger_update_finance_einvoices_updated_at
  BEFORE UPDATE ON finance_einvoices
  FOR EACH ROW
  EXECUTE FUNCTION update_finance_einvoices_updated_at();

-- Row Level Security Policy (Tenant Isolation)
ALTER TABLE finance_einvoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_finance_einvoices ON finance_einvoices;
CREATE POLICY tenant_isolation_finance_einvoices ON finance_einvoices
  FOR ALL
  USING (tenant_id::text = current_setting('app.current_tenant_id', true)::uuid);

/*
-- Reversible Down Migration
DROP POLICY IF EXISTS tenant_isolation_finance_einvoices ON finance_einvoices;
DROP TRIGGER IF EXISTS trigger_update_finance_einvoices_updated_at ON finance_einvoices;
DROP FUNCTION IF EXISTS update_finance_einvoices_updated_at();
DROP TABLE IF EXISTS finance_einvoices;
*/
