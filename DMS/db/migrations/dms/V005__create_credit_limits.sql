-- =============================================================================
-- V005: Create credit_limits table
-- Manages distributor credit limits, utilization, and review cycles.
-- All monetary values stored as BIGINT (paise/cents).
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS credit_limits (
  id                        UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID          NOT NULL,
  distributor_id            UUID          NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
  credit_limit              BIGINT        NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
  utilized_amount           BIGINT        NOT NULL DEFAULT 0 CHECK (utilized_amount >= 0),
  temporary_limit_increase  BIGINT        DEFAULT 0 CHECK (temporary_limit_increase >= 0),
  temporary_limit_expiry    TIMESTAMPTZ,
  last_review_date          DATE,
  next_review_date          DATE,
  credit_rating             VARCHAR(1)    NOT NULL DEFAULT 'C'
                              CHECK (credit_rating IN ('A','B','C','D')),
  payment_term_days         INTEGER       NOT NULL DEFAULT 30 CHECK (payment_term_days > 0),
  version                   INTEGER       NOT NULL DEFAULT 1,
  created_at                TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ   NOT NULL DEFAULT now(),

  -- One credit limit record per distributor per tenant
  CONSTRAINT uq_credit_distributor UNIQUE (tenant_id, distributor_id)
);

-- Indexes
CREATE INDEX idx_cl_tenant           ON credit_limits (tenant_id);
CREATE INDEX idx_cl_distributor      ON credit_limits (tenant_id, distributor_id);
CREATE INDEX idx_cl_rating           ON credit_limits (tenant_id, credit_rating);
CREATE INDEX idx_cl_review           ON credit_limits (next_review_date) WHERE next_review_date IS NOT NULL;
CREATE INDEX idx_cl_temp_expiry      ON credit_limits (temporary_limit_expiry) WHERE temporary_limit_expiry IS NOT NULL;

CREATE TRIGGER trg_cl_updated_at
  BEFORE UPDATE ON credit_limits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
