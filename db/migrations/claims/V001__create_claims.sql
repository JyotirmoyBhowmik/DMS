-- =============================================================================
-- V001: Create claims schema with RLS policies
-- =============================================================================

BEGIN;

-- 1. Claims Table
CREATE TABLE IF NOT EXISTS claims (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID          NOT NULL,
  distributor_id      UUID          NOT NULL,
  scheme_id           UUID          NOT NULL,
  amount              BIGINT        NOT NULL CHECK (amount > 0),
  settled_amount      BIGINT        NOT NULL DEFAULT 0,
  status              VARCHAR(50)   NOT NULL DEFAULT 'raised' 
                        CHECK (status IN ('raised', 'validated', 'approved', 'settled', 'rejected')),
  duplicate_check_key VARCHAR(255),
  version             INTEGER       NOT NULL DEFAULT 1,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT unique_tenant_duplicate_check_key UNIQUE (tenant_id, duplicate_check_key),
  CONSTRAINT check_settled_amount CHECK (settled_amount <= amount)
);

-- 2. Claim Reconciliations Table
CREATE TABLE IF NOT EXISTS claim_reconciliations (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID          NOT NULL,
  claim_id            UUID          NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  scheme_id           UUID          NOT NULL,
  status              VARCHAR(50)   NOT NULL CHECK (status IN ('success', 'mismatch', 'failed')),
  remarks             TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- 3. Claim Settlement Transactions Table
CREATE TABLE IF NOT EXISTS claim_settlement_transactions (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID          NOT NULL,
  claim_id            UUID          NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  idempotency_key     VARCHAR(255)  NOT NULL,
  amount              BIGINT        NOT NULL CHECK (amount > 0),
  status              VARCHAR(50)   NOT NULL CHECK (status IN ('success', 'failed')),
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT unique_tenant_idempotency_key UNIQUE (tenant_id, idempotency_key)
);

-- 4. Claim Audit History Table
CREATE TABLE IF NOT EXISTS claim_audit_history (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID          NOT NULL,
  claim_id            UUID          NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  action              VARCHAR(50)   NOT NULL,
  actor_id            VARCHAR(255)  NOT NULL,
  prev_status         VARCHAR(50),
  new_status          VARCHAR(50)   NOT NULL,
  payload             JSONB         NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- 5. Outbox Table for claims
CREATE TABLE IF NOT EXISTS claims_outbox (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID          NOT NULL,
  aggregate_type      VARCHAR(64)   NOT NULL,
  aggregate_id        UUID          NOT NULL,
  event_type          VARCHAR(128)  NOT NULL,
  payload             JSONB         NOT NULL,
  metadata            JSONB         NOT NULL DEFAULT '{}',
  destination_topic   VARCHAR(256)  NOT NULL DEFAULT 'claims-events',
  next_attempt_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  partition_key       VARCHAR(128),
  sequence_num        BIGSERIAL,
  status              VARCHAR(20)   NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING','PUBLISHED','FAILED')),
  retry_count         INTEGER       NOT NULL DEFAULT 0,
  max_retries         INTEGER       NOT NULL DEFAULT 5,
  last_error          TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  published_at        TIMESTAMPTZ
);

-- 6. Processed Events Table for claims (Idempotent Consumer)
CREATE TABLE IF NOT EXISTS claims_processed_events (
  event_id            UUID          NOT NULL,
  tenant_id           UUID          NOT NULL,
  event_type          VARCHAR(128)  NOT NULL,
  source_service      VARCHAR(64)   NOT NULL,
  aggregate_id        UUID,
  processed_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  result              VARCHAR(20)   NOT NULL DEFAULT 'SUCCESS'
                        CHECK (result IN ('SUCCESS','FAILED','SKIPPED')),
  error_message       TEXT,
  PRIMARY KEY (tenant_id, event_id)
);

-- Enable RLS
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_settlement_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_audit_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims_processed_events ENABLE ROW LEVEL SECURITY;

-- Create tenant isolation policies
CREATE POLICY tenant_isolation_claims ON claims
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_isolation_claim_reconciliations ON claim_reconciliations
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_isolation_claim_settlement_transactions ON claim_settlement_transactions
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_isolation_claim_audit_history ON claim_audit_history
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_isolation_claims_outbox ON claims_outbox
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_isolation_claims_processed_events ON claims_processed_events
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

-- Trigger: auto-update updated_at on claims modification
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER claims_set_updated_at
  BEFORE UPDATE ON claims
  FOR EACH ROW
  EXECUTE FUNCTION trg_set_updated_at();

-- Indexes
CREATE INDEX idx_claims_tenant ON claims (tenant_id);
CREATE INDEX idx_claims_distributor ON claims (tenant_id, distributor_id);
CREATE INDEX idx_claims_status ON claims (tenant_id, status);

CREATE INDEX idx_claim_reconciliations_tenant ON claim_reconciliations (tenant_id);
CREATE INDEX idx_claim_reconciliations_claim ON claim_reconciliations (claim_id);

CREATE INDEX idx_claim_settlements_tenant ON claim_settlement_transactions (tenant_id);
CREATE INDEX idx_claim_settlements_claim ON claim_settlement_transactions (claim_id);

CREATE INDEX idx_claim_audit_history_tenant ON claim_audit_history (tenant_id);
CREATE INDEX idx_claim_audit_history_claim ON claim_audit_history (claim_id);

CREATE INDEX idx_claims_outbox_pending  ON claims_outbox (status, created_at) WHERE status = 'PENDING';
CREATE INDEX idx_claims_outbox_tenant   ON claims_outbox (tenant_id);
CREATE INDEX idx_claims_outbox_agg      ON claims_outbox (aggregate_type, aggregate_id);
CREATE INDEX idx_claims_outbox_seq      ON claims_outbox (sequence_num);

CREATE INDEX idx_claims_pe_event_type   ON claims_processed_events (tenant_id, event_type);
CREATE INDEX idx_claims_pe_processed_at ON claims_processed_events (processed_at);
CREATE INDEX idx_claims_pe_source       ON claims_processed_events (source_service, processed_at);

COMMIT;
