-- =============================================================================
-- V001: Create tables for system synchronization and cryptographic logs
-- Supports offline-first client replication and SOC 2 compliance ledger.
-- =============================================================================

BEGIN;

-- 1. Sync Queue Table
CREATE TABLE IF NOT EXISTS client_sync_queues (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID          NOT NULL,
  client_id       VARCHAR(255)  NOT NULL,
  mutation_batch  JSONB         NOT NULL DEFAULT '[]',
  processed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- 2. Sync Conflict Records Table
CREATE TABLE IF NOT EXISTS sync_conflict_records (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID          NOT NULL,
  mutation_id     VARCHAR(255)  NOT NULL,
  table_name      VARCHAR(100)  NOT NULL,
  row_id          VARCHAR(255)  NOT NULL,
  client_version  INTEGER       NOT NULL,
  server_version  INTEGER       NOT NULL,
  resolved_row    JSONB         NOT NULL,
  resolution      VARCHAR(50)   NOT NULL, -- LWW, MANUAL_REVIEW_REQUIRED, etc.
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- 3. Cryptographic Audit Log Ledger Table
CREATE TABLE IF NOT EXISTS tamper_evident_audit_log (
  block_number    BIGINT        PRIMARY KEY,
  tenant_id       UUID          NOT NULL,
  event_data      JSONB         NOT NULL,
  hash            VARCHAR(64)   NOT NULL UNIQUE,
  prev_hash       VARCHAR(64)   NOT NULL,
  timestamp       TIMESTAMPTZ   NOT NULL,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Indexing
CREATE INDEX idx_sync_queue_processed ON client_sync_queues (tenant_id, processed_at);
CREATE INDEX idx_sync_conflicts       ON sync_conflict_records (tenant_id, table_name, row_id);
CREATE INDEX idx_audit_log_hash       ON tamper_evident_audit_log (tenant_id, hash);

COMMIT;
