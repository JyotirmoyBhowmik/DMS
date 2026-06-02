-- =============================================================================
-- V002: Create dms_outbox and dms_processed_events tables
-- Implements Transactional Outbox and Idempotent Consumer patterns for DMS.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS dms_outbox (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID         NOT NULL,
  aggregate_type    VARCHAR(64)  NOT NULL,
  aggregate_id      UUID         NOT NULL,
  event_type        VARCHAR(128) NOT NULL,
  payload           JSONB        NOT NULL,
  metadata          JSONB        NOT NULL DEFAULT '{}',
  destination_topic VARCHAR(256) NOT NULL,
  partition_key     VARCHAR(128),
  sequence_num      BIGSERIAL,
  status            VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
                      CHECK (status IN ('PENDING','PUBLISHED','FAILED')),
  retry_count       INTEGER      NOT NULL DEFAULT 0,
  max_retries       INTEGER      NOT NULL DEFAULT 5,
  last_error        TEXT,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  published_at      TIMESTAMPTZ
);

CREATE INDEX idx_dms_outbox_pending  ON dms_outbox (status, created_at) WHERE status = 'PENDING';
CREATE INDEX idx_dms_outbox_tenant   ON dms_outbox (tenant_id);
CREATE INDEX idx_dms_outbox_seq      ON dms_outbox (sequence_num);

CREATE TABLE IF NOT EXISTS dms_processed_events (
  event_id          UUID         NOT NULL,
  tenant_id         UUID         NOT NULL,
  event_type        VARCHAR(128) NOT NULL,
  source_service    VARCHAR(64)  NOT NULL,
  aggregate_id      UUID,
  processed_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  result            VARCHAR(20)  NOT NULL DEFAULT 'SUCCESS'
                      CHECK (result IN ('SUCCESS','FAILED','SKIPPED')),
  error_message     TEXT,
  PRIMARY KEY (tenant_id, event_id)
);

CREATE INDEX idx_dms_pe_event_type   ON dms_processed_events (tenant_id, event_type);
CREATE INDEX idx_dms_pe_processed_at ON dms_processed_events (processed_at);

COMMIT;
