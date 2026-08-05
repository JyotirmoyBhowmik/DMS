-- =============================================================================
-- V030: Create field_reps table for Sales Force Automation (SFA)
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS field_reps (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID         NOT NULL,
  user_id           UUID         NOT NULL,
  employee_code     VARCHAR(32)  NOT NULL,
  first_name        VARCHAR(128) NOT NULL,
  last_name         VARCHAR(128) NOT NULL,
  email             VARCHAR(256) NOT NULL,
  phone             VARCHAR(20)  NOT NULL,
  status            VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE'
                      CHECK (status IN ('ACTIVE','INACTIVE','SUSPENDED','TERMINATED')),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  version           INTEGER      NOT NULL DEFAULT 1,
  UNIQUE(tenant_id, employee_code),
  UNIQUE(tenant_id, user_id)
);

COMMENT ON TABLE field_reps IS 'Field sales representatives details';

-- Indexes
CREATE INDEX idx_field_reps_tenant       ON field_reps (tenant_id);
CREATE INDEX idx_field_reps_user         ON field_reps (tenant_id, user_id);
CREATE INDEX idx_field_reps_status       ON field_reps (tenant_id, status);

-- Trigger for updated_at
CREATE TRIGGER field_reps_set_updated_at
  BEFORE UPDATE ON field_reps
  FOR EACH ROW
  EXECUTE FUNCTION trg_set_updated_at();

-- Enable RLS
ALTER TABLE field_reps ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation policy
DROP POLICY IF EXISTS field_reps_tenant_isolation ON field_reps;
CREATE POLICY field_reps_tenant_isolation ON field_reps
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

COMMIT;
