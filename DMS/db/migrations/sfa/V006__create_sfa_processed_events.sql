-- =============================================================================
-- V006: Create sfa_processed_events table (Idempotent Consumer Pattern)
-- Prevents duplicate processing of inbound domain events.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS sfa_processed_events (
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

COMMENT ON TABLE sfa_processed_events IS 'Idempotent consumer deduplication for inbound events';

CREATE INDEX idx_sfa_pe_event_type   ON sfa_processed_events (tenant_id, event_type);
CREATE INDEX idx_sfa_pe_processed_at ON sfa_processed_events (processed_at);
CREATE INDEX idx_sfa_pe_source       ON sfa_processed_events (source_service, processed_at);

-- Auto-purge events older than 30 days (run via pg_cron or application scheduler)
-- SELECT cron.schedule('purge-sfa-processed-events', '0 3 * * *',
--   $$DELETE FROM sfa_processed_events WHERE processed_at < now() - INTERVAL '30 days'$$);

COMMIT;
