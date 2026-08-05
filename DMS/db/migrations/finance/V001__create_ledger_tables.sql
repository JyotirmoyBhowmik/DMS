BEGIN;

-- 1. Create update_updated_at_column function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Ledger Accounts Table
CREATE TABLE IF NOT EXISTS ledger_accounts (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID          NOT NULL,
  account_number    VARCHAR(50)   NOT NULL,
  name              VARCHAR(100)  NOT NULL,
  type              VARCHAR(20)   NOT NULL CHECK (type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
  balance           BIGINT        NOT NULL DEFAULT 0, -- signed balance: debits (+) / credits (-)
  credit_limit      BIGINT        NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
  version           INTEGER       NOT NULL DEFAULT 1,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  closed_at         TIMESTAMPTZ,
  CONSTRAINT uq_ledger_account UNIQUE (tenant_id, account_number)
);

-- 3. Ledger Periods Table
CREATE TABLE IF NOT EXISTS ledger_periods (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID          NOT NULL,
  start_date        DATE          NOT NULL,
  end_date          DATE          NOT NULL,
  status            VARCHAR(20)   NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT uq_ledger_period UNIQUE (tenant_id, start_date, end_date),
  CONSTRAINT chk_dates CHECK (start_date <= end_date)
);

-- 4. Ledger Entries Table
CREATE TABLE IF NOT EXISTS ledger_entries (
  id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID          NOT NULL,
  reference_type     VARCHAR(50)   NOT NULL, -- 'ORDER', 'CLAIM', 'SCHEME', 'MANUAL'
  reference_id       UUID          NOT NULL, -- e.g. order_id, claim_id
  description        TEXT          NOT NULL,
  status             VARCHAR(20)   NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED', 'REVERSED')),
  reversed_entry_id  UUID          REFERENCES ledger_entries(id),
  posted_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  idempotency_key    VARCHAR(100)  NOT NULL,
  version            INTEGER       NOT NULL DEFAULT 1,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT uq_ledger_entry_idempotency UNIQUE (tenant_id, idempotency_key)
);

-- 5. Ledger Postings Table
CREATE TABLE IF NOT EXISTS ledger_postings (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID          NOT NULL,
  entry_id          UUID          NOT NULL REFERENCES ledger_entries(id) ON DELETE CASCADE,
  account_id        UUID          NOT NULL REFERENCES ledger_accounts(id),
  type              VARCHAR(10)   NOT NULL CHECK (type IN ('DEBIT', 'CREDIT')),
  amount            BIGINT        NOT NULL CHECK (amount > 0),
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- 6. Outbox Table for Finance Service
CREATE TABLE IF NOT EXISTS finance_outbox (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID         NOT NULL,
  aggregate_type    VARCHAR(64)  NOT NULL,
  aggregate_id      UUID         NOT NULL,
  event_type        VARCHAR(128) NOT NULL,
  payload           JSONB        NOT NULL,
  metadata          JSONB        NOT NULL DEFAULT '{}',
  destination_topic VARCHAR(256) NOT NULL DEFAULT 'finance-events',
  next_attempt_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  partition_key     VARCHAR(128),
  sequence_num      BIGSERIAL,
  status            VARCHAR(20)  NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PUBLISHED','FAILED')),
  retry_count       INTEGER      NOT NULL DEFAULT 0,
  max_retries       INTEGER      NOT NULL DEFAULT 5,
  last_error        TEXT,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  published_at      TIMESTAMPTZ
);

-- 7. Processed Events (Idempotency)
CREATE TABLE IF NOT EXISTS finance_processed_events (
  event_id          UUID         NOT NULL,
  tenant_id         UUID         NOT NULL,
  event_type        VARCHAR(128) NOT NULL,
  source_service    VARCHAR(64)  NOT NULL,
  aggregate_id      UUID,
  processed_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  result            VARCHAR(20)  NOT NULL DEFAULT 'SUCCESS' CHECK (result IN ('SUCCESS','FAILED','SKIPPED')),
  error_message     TEXT,
  PRIMARY KEY (tenant_id, event_id)
);

-- 8. Triggers for Auto-updating updated_at
CREATE TRIGGER trg_ledger_accounts_updated_at
  BEFORE UPDATE ON ledger_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_ledger_periods_updated_at
  BEFORE UPDATE ON ledger_periods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_ledger_entries_updated_at
  BEFORE UPDATE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 9. Row Level Security Policies
ALTER TABLE ledger_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_ledger_accounts ON ledger_accounts;
CREATE POLICY tenant_isolation_ledger_accounts ON ledger_accounts
  FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

ALTER TABLE ledger_periods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_ledger_periods ON ledger_periods;
CREATE POLICY tenant_isolation_ledger_periods ON ledger_periods
  FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_ledger_entries ON ledger_entries;
CREATE POLICY tenant_isolation_ledger_entries ON ledger_entries
  FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

ALTER TABLE ledger_postings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_ledger_postings ON ledger_postings;
CREATE POLICY tenant_isolation_ledger_postings ON ledger_postings
  FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

ALTER TABLE finance_outbox ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_finance_outbox ON finance_outbox;
CREATE POLICY tenant_isolation_finance_outbox ON finance_outbox
  FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

ALTER TABLE finance_processed_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_finance_processed_events ON finance_processed_events;
CREATE POLICY tenant_isolation_finance_processed_events ON finance_processed_events
  FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

-- 10. Indexes
CREATE INDEX idx_la_tenant ON ledger_accounts (tenant_id);
CREATE INDEX idx_la_number ON ledger_accounts (tenant_id, account_number);

CREATE INDEX idx_lp_tenant ON ledger_periods (tenant_id);
CREATE INDEX idx_lp_dates ON ledger_periods (tenant_id, start_date, end_date);

CREATE INDEX idx_le_tenant ON ledger_entries (tenant_id);
CREATE INDEX idx_le_ref ON ledger_entries (tenant_id, reference_type, reference_id);

CREATE INDEX idx_lpo_entry ON ledger_postings (tenant_id, entry_id);
CREATE INDEX idx_lpo_account ON ledger_postings (tenant_id, account_id);

CREATE INDEX idx_fo_pending ON finance_outbox (status, created_at) WHERE status = 'PENDING';
CREATE INDEX idx_fo_tenant ON finance_outbox (tenant_id);

CREATE INDEX idx_fpe_processed ON finance_processed_events (processed_at);

COMMIT;
