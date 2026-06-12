-- =============================================================================
-- V004: Add next_attempt_at column to outbox_events to support dispatcher retries with backoff.
-- =============================================================================

BEGIN;

ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Index for scheduled/pending outbox events
CREATE INDEX IF NOT EXISTS idx_outbox_next_attempt 
  ON outbox_events (next_attempt_at ASC) 
  WHERE published_at IS NULL AND retry_count < max_retries;

COMMIT;
