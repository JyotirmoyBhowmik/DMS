-- =============================================================================
-- V005: Create sfa_outbox table (Transactional Outbox Pattern)
-- Guarantees at-least-once delivery of domain events to Kafka via CDC/polling.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS sfa_outbox (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID         NOT NULL,
  aggregate_type    VARCHAR(64)  NOT NULL,
  aggregate_id      UUID         NOT NULL,
  event_type        VARCHAR(128) NOT NULL,
  payload           JSONB        NOT NULL,
  metadata          JSONB        NOT NULL DEFAULT '{}',
  destination_topic VARCHAR(256) NOT NULL DEFAULT 'sfa-events',
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

COMMENT ON TABLE sfa_outbox IS 'Transactional outbox for reliable SFA domain event publishing';

CREATE INDEX idx_sfa_outbox_pending  ON sfa_outbox (status, created_at)
  WHERE status = 'PENDING';
CREATE INDEX idx_sfa_outbox_tenant   ON sfa_outbox (tenant_id);
CREATE INDEX idx_sfa_outbox_agg      ON sfa_outbox (aggregate_type, aggregate_id);
CREATE INDEX idx_sfa_outbox_seq      ON sfa_outbox (sequence_num);

COMMIT;
