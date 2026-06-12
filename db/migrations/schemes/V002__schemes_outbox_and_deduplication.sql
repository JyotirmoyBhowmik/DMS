-- =============================================================================
-- V002: Create schemes_outbox and schemes_processed_events tables
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS schemes_outbox (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID         NOT NULL,
  aggregate_type    VARCHAR(64)  NOT NULL,
  aggregate_id      UUID         NOT NULL,
  event_type        VARCHAR(128) NOT NULL,
  payload           JSONB        NOT NULL,
  metadata          JSONB        NOT NULL DEFAULT '{}',
  destination_topic VARCHAR(256) NOT NULL DEFAULT 'schemes-events',
  next_attempt_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
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

CREATE INDEX idx_schemes_outbox_pending  ON schemes_outbox (status, created_at)
  WHERE status = 'PENDING';
CREATE INDEX idx_schemes_outbox_tenant   ON schemes_outbox (tenant_id);
CREATE INDEX idx_schemes_outbox_agg      ON schemes_outbox (aggregate_type, aggregate_id);
CREATE INDEX idx_schemes_outbox_seq      ON schemes_outbox (sequence_num);

CREATE TABLE IF NOT EXISTS schemes_processed_events (
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

CREATE INDEX idx_schemes_pe_event_type   ON schemes_processed_events (tenant_id, event_type);
CREATE INDEX idx_schemes_pe_processed_at ON schemes_processed_events (processed_at);
CREATE INDEX idx_schemes_pe_source       ON schemes_processed_events (source_service, processed_at);

COMMIT;
