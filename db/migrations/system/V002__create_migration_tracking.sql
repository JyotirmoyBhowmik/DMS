-- =============================================================================
-- V002: Create migration tracking and event infrastructure tables.
--
--  1. schema_migrations     – tracks which SQL migrations have been applied
--  2. outbox_events         – transactional outbox for reliable event publishing
--  3. processed_events      – idempotent consumer deduplication ledger
-- =============================================================================

BEGIN;

-- 1. Schema Migrations
CREATE TABLE IF NOT EXISTS schema_migrations (
  version           VARCHAR(20)   PRIMARY KEY,
  description       TEXT          NOT NULL,
  filename          VARCHAR(255)  NOT NULL,
  checksum          VARCHAR(16)   NOT NULL,
  applied_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  execution_time_ms INTEGER       NOT NULL DEFAULT 0
);

-- 2. Outbox Events (transactional outbox pattern)
CREATE TABLE IF NOT EXISTS outbox_events (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID          NOT NULL,
  aggregate_type  VARCHAR(100)  NOT NULL,
  aggregate_id    VARCHAR(255)  NOT NULL,
  event_type      VARCHAR(255)  NOT NULL,
  payload         JSONB         NOT NULL,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  published_at    TIMESTAMPTZ,
  retry_count     INTEGER       NOT NULL DEFAULT 0,
  max_retries     INTEGER       NOT NULL DEFAULT 5,
  last_error      TEXT
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending
  ON outbox_events (created_at ASC)
  WHERE published_at IS NULL AND retry_count < max_retries;

CREATE INDEX IF NOT EXISTS idx_outbox_tenant
  ON outbox_events (tenant_id, created_at);

-- 3. Processed Events (idempotent consumer deduplication)
CREATE TABLE IF NOT EXISTS processed_events (
  event_id        VARCHAR(255)  NOT NULL,
  consumer_group  VARCHAR(100)  NOT NULL,
  processed_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, consumer_group)
);

CREATE INDEX IF NOT EXISTS idx_processed_events_consumer
  ON processed_events (consumer_group, processed_at);

-- RLS policies
ALTER TABLE outbox_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE processed_events   ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_outbox_events ON outbox_events
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

COMMIT;
