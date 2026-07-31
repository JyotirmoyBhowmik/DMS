-- Migration: V011__add_tax_filing_constraints.sql
-- Description: TaxFiling table schema with constraints, composite indexes, versioning for optimistic locking, and tenant RLS isolation.

CREATE TABLE IF NOT EXISTS finance_tax_filings (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  period VARCHAR(32) NOT NULL,
  tax_type VARCHAR(32) NOT NULL,
  taxable_amount_cents BIGINT NOT NULL DEFAULT 0 CHECK (taxable_amount_cents >= 0),
  tax_amount_cents BIGINT NOT NULL DEFAULT 0 CHECK (tax_amount_cents >= 0),
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'FILED', 'ACCEPTED', 'REJECTED')),
  acknowledgement_number VARCHAR(64),
  filing_date TIMESTAMPTZ,
  idempotency_key VARCHAR(128),
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_taxfiling_tenant_period_type UNIQUE (tenant_id, period, tax_type)
);

-- Performance Composite Indexes
CREATE INDEX IF NOT EXISTS idx_taxfilings_tenant_status ON finance_tax_filings(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_taxfilings_period ON finance_tax_filings(tenant_id, period);

-- Version Auto-Incrementing Trigger
CREATE OR REPLACE FUNCTION update_finance_tax_filings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_finance_tax_filings_updated_at ON finance_tax_filings;
CREATE TRIGGER trigger_update_finance_tax_filings_updated_at
  BEFORE UPDATE ON finance_tax_filings
  FOR EACH ROW
  EXECUTE FUNCTION update_finance_tax_filings_updated_at();

-- Row Level Security Policy (Tenant Isolation)
ALTER TABLE finance_tax_filings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_finance_tax_filings ON finance_tax_filings;
CREATE POLICY tenant_isolation_finance_tax_filings ON finance_tax_filings
  FOR ALL
  USING (tenant_id::text = current_setting('app.current_tenant_id', true)::uuid);

/*
-- Reversible Down Migration
DROP POLICY IF EXISTS tenant_isolation_finance_tax_filings ON finance_tax_filings;
DROP TRIGGER IF EXISTS trigger_update_finance_tax_filings_updated_at ON finance_tax_filings;
DROP FUNCTION IF EXISTS update_finance_tax_filings_updated_at();
DROP TABLE IF EXISTS finance_tax_filings;
*/
