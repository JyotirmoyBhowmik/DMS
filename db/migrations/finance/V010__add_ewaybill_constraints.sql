-- Migration: V010__add_ewaybill_constraints.sql
-- Description: eWayBill table schema with constraints, composite indexes, versioning for optimistic locking, and tenant RLS isolation.

CREATE TABLE IF NOT EXISTS finance_ewaybills (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  invoice_id UUID NOT NULL,
  eway_bill_number VARCHAR(64) NOT NULL,
  valid_until TIMESTAMPTZ,
  vehicle_number VARCHAR(32),
  transporter_id VARCHAR(64),
  distance_km INT NOT NULL DEFAULT 0 CHECK (distance_km >= 0),
  status VARCHAR(32) NOT NULL DEFAULT 'GENERATED' CHECK (status IN ('GENERATED', 'ACTIVE', 'CANCELLED', 'EXPIRED')),
  idempotency_key VARCHAR(128),
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_ewaybill_tenant_number UNIQUE (tenant_id, eway_bill_number)
);

-- Performance Composite Indexes
CREATE INDEX IF NOT EXISTS idx_ewaybills_tenant_status ON finance_ewaybills(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ewaybills_invoice ON finance_ewaybills(tenant_id, invoice_id);

-- Version Auto-Incrementing Trigger
CREATE OR REPLACE FUNCTION update_finance_ewaybills_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_finance_ewaybills_updated_at ON finance_ewaybills;
CREATE TRIGGER trigger_update_finance_ewaybills_updated_at
  BEFORE UPDATE ON finance_ewaybills
  FOR EACH ROW
  EXECUTE FUNCTION update_finance_ewaybills_updated_at();

-- Row Level Security Policy (Tenant Isolation)
ALTER TABLE finance_ewaybills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_finance_ewaybills ON finance_ewaybills;
CREATE POLICY tenant_isolation_finance_ewaybills ON finance_ewaybills
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

/*
-- Reversible Down Migration
DROP POLICY IF EXISTS tenant_isolation_finance_ewaybills ON finance_ewaybills;
DROP TRIGGER IF EXISTS trigger_update_finance_ewaybills_updated_at ON finance_ewaybills;
DROP FUNCTION IF EXISTS update_finance_ewaybills_updated_at();
DROP TABLE IF EXISTS finance_ewaybills;
*/
