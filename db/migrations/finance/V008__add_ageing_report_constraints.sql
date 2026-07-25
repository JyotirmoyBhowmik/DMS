-- Migration: V008__add_ageing_report_constraints.sql
-- Description: AgeingReport table schema with constraints, composite indexes, versioning for optimistic locking, and tenant RLS isolation.

CREATE TABLE IF NOT EXISTS finance_ageing_reports (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  distributor_id VARCHAR(64) NOT NULL,
  as_of_date DATE NOT NULL,
  current_bucket_cents BIGINT NOT NULL DEFAULT 0 CHECK (current_bucket_cents >= 0),
  bucket_1_30_cents BIGINT NOT NULL DEFAULT 0 CHECK (bucket_1_30_cents >= 0),
  bucket_31_60_cents BIGINT NOT NULL DEFAULT 0 CHECK (bucket_31_60_cents >= 0),
  bucket_61_90_cents BIGINT NOT NULL DEFAULT 0 CHECK (bucket_61_90_cents >= 0),
  bucket_90_plus_cents BIGINT NOT NULL DEFAULT 0 CHECK (bucket_90_plus_cents >= 0),
  total_outstanding_cents BIGINT NOT NULL CHECK (total_outstanding_cents >= 0),
  status VARCHAR(32) NOT NULL DEFAULT 'GENERATED' CHECK (status IN ('GENERATED', 'VERIFIED', 'RECONCILED', 'ARCHIVED')),
  idempotency_key VARCHAR(128),
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_ageing_report_tenant_distributor_date UNIQUE (tenant_id, distributor_id, as_of_date)
);

-- Performance Composite Indexes
CREATE INDEX IF NOT EXISTS idx_ageing_reports_tenant_status ON finance_ageing_reports(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ageing_reports_distributor ON finance_ageing_reports(tenant_id, distributor_id);

-- Version Auto-Incrementing Trigger
CREATE OR REPLACE FUNCTION update_finance_ageing_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_finance_ageing_reports_updated_at ON finance_ageing_reports;
CREATE TRIGGER trigger_update_finance_ageing_reports_updated_at
  BEFORE UPDATE ON finance_ageing_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_finance_ageing_reports_updated_at();

-- Row Level Security Policy (Tenant Isolation)
ALTER TABLE finance_ageing_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_finance_ageing_reports ON finance_ageing_reports;
CREATE POLICY tenant_isolation_finance_ageing_reports ON finance_ageing_reports
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

/*
-- Reversible Down Migration
DROP POLICY IF EXISTS tenant_isolation_finance_ageing_reports ON finance_ageing_reports;
DROP TRIGGER IF EXISTS trigger_update_finance_ageing_reports_updated_at ON finance_ageing_reports;
DROP FUNCTION IF EXISTS update_finance_ageing_reports_updated_at();
DROP TABLE IF EXISTS finance_ageing_reports;
*/
