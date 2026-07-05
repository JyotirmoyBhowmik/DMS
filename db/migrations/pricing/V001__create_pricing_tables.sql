-- =============================================================================
-- V001: Create pricing-service database schema with RLS and Audit Trail
-- =============================================================================

BEGIN;

-- 1. Create Price Lists Table
CREATE TABLE IF NOT EXISTS pricing_price_lists (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID          NOT NULL,
  name            VARCHAR(255)  NOT NULL,
  description     TEXT,
  effective_from  TIMESTAMPTZ   NOT NULL,
  effective_to    TIMESTAMPTZ,
  is_active       BOOLEAN       NOT NULL DEFAULT true,
  version         INTEGER       NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT uq_pricing_pl_name UNIQUE (tenant_id, name)
);

-- 2. Create Price List Assignments Table
CREATE TABLE IF NOT EXISTS pricing_price_list_assignments (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID          NOT NULL,
  price_list_id     UUID          NOT NULL REFERENCES pricing_price_lists(id) ON DELETE CASCADE,
  assignment_type   VARCHAR(50)   NOT NULL CHECK (assignment_type IN ('default', 'channel', 'customer')),
  assignment_value  VARCHAR(255), -- channel code or customer/outlet ID, or NULL for default
  priority          INTEGER       NOT NULL DEFAULT 0,
  version           INTEGER       NOT NULL DEFAULT 1,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT uq_pricing_pl_assignment UNIQUE (tenant_id, assignment_type, assignment_value)
);

-- 3. Create Price List Entries Table
CREATE TABLE IF NOT EXISTS pricing_price_list_entries (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  price_list_id   UUID          NOT NULL REFERENCES pricing_price_lists(id) ON DELETE CASCADE,
  product_id      UUID          NOT NULL,
  base_price      BIGINT        NOT NULL CHECK (base_price >= 0),
  mrp             BIGINT        NOT NULL CHECK (mrp >= 0),
  tax_rule_key    VARCHAR(50)   NOT NULL DEFAULT 'GST_18',
  rounding_rule   VARCHAR(50)   NOT NULL DEFAULT 'HALF_UP',
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT uq_pricing_ple_product UNIQUE (price_list_id, product_id),
  CONSTRAINT chk_pricing_mrp_gte_base CHECK (mrp >= base_price)
);

-- 4. Create Entry Volume Slabs / Tiers Table
CREATE TABLE IF NOT EXISTS pricing_price_list_entry_tiers (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id            UUID          NOT NULL REFERENCES pricing_price_list_entries(id) ON DELETE CASCADE,
  min_quantity        INTEGER       NOT NULL CHECK (min_quantity > 0),
  discount_percentage NUMERIC(5, 2) CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  discount_flat       BIGINT        CHECK (discount_flat >= 0),
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT uq_pricing_tier_qty UNIQUE (entry_id, min_quantity),
  CONSTRAINT chk_discount_defined CHECK (
    (discount_percentage IS NOT NULL AND discount_flat IS NULL) OR
    (discount_percentage IS NULL AND discount_flat IS NOT NULL)
  )
);

-- 5. Create Transactional Outbox Table
CREATE TABLE IF NOT EXISTS pricing_outbox (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID         NOT NULL,
  aggregate_type    VARCHAR(64)  NOT NULL,
  aggregate_id      UUID         NOT NULL,
  event_type        VARCHAR(128) NOT NULL,
  payload           JSONB        NOT NULL,
  metadata          JSONB        NOT NULL DEFAULT '{}',
  destination_topic VARCHAR(256) NOT NULL DEFAULT 'pricing-events',
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

-- 6. Create Processed Events Table (for Idempotent Consumers)
CREATE TABLE IF NOT EXISTS pricing_processed_events (
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

-- 7. Create Pricing Audit Trail Table
CREATE TABLE IF NOT EXISTS pricing_audit_trail (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID          NOT NULL,
  price_list_id   UUID          NOT NULL,
  product_id      UUID          NOT NULL,
  actor_id        VARCHAR(255)  NOT NULL,
  action_type     VARCHAR(50)   NOT NULL,
  old_base_price  BIGINT,
  new_base_price  BIGINT,
  old_mrp         BIGINT,
  new_mrp         BIGINT,
  reason          TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- RLS (Row Level Security) Configuration
ALTER TABLE pricing_price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_price_list_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_price_list_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_price_list_entry_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_processed_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_audit_trail ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
CREATE POLICY tenant_isolation_pricing_pl ON pricing_price_lists
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_pricing_pla ON pricing_price_list_assignments
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_pricing_ple ON pricing_price_list_entries
  USING (
    price_list_id IN (SELECT id FROM pricing_price_lists WHERE tenant_id = current_setting('app.tenant_id', true)::uuid)
  )
  WITH CHECK (
    price_list_id IN (SELECT id FROM pricing_price_lists WHERE tenant_id = current_setting('app.tenant_id', true)::uuid)
  );

CREATE POLICY tenant_isolation_pricing_plet ON pricing_price_list_entry_tiers
  USING (
    entry_id IN (
      SELECT ple.id FROM pricing_price_list_entries ple
      JOIN pricing_price_lists pl ON ple.price_list_id = pl.id
      WHERE pl.tenant_id = current_setting('app.tenant_id', true)::uuid
    )
  )
  WITH CHECK (
    entry_id IN (
      SELECT ple.id FROM pricing_price_list_entries ple
      JOIN pricing_price_lists pl ON ple.price_list_id = pl.id
      WHERE pl.tenant_id = current_setting('app.tenant_id', true)::uuid
    )
  );

CREATE POLICY tenant_isolation_pricing_outbox ON pricing_outbox
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_pricing_pe ON pricing_processed_events
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_pricing_audit ON pricing_audit_trail
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Trigger: auto-update updated_at on modification
CREATE OR REPLACE FUNCTION trg_pricing_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pricing_pl_set_updated_at
  BEFORE UPDATE ON pricing_price_lists
  FOR EACH ROW EXECUTE FUNCTION trg_pricing_set_updated_at();

CREATE TRIGGER pricing_pla_set_updated_at
  BEFORE UPDATE ON pricing_price_list_assignments
  FOR EACH ROW EXECUTE FUNCTION trg_pricing_set_updated_at();

CREATE TRIGGER pricing_ple_set_updated_at
  BEFORE UPDATE ON pricing_price_list_entries
  FOR EACH ROW EXECUTE FUNCTION trg_pricing_set_updated_at();

CREATE TRIGGER pricing_plet_set_updated_at
  BEFORE UPDATE ON pricing_price_list_entry_tiers
  FOR EACH ROW EXECUTE FUNCTION trg_pricing_set_updated_at();

-- Indexes for Quick Queries
CREATE INDEX idx_pricing_pl_tenant ON pricing_price_lists (tenant_id);
CREATE INDEX idx_pricing_pl_active ON pricing_price_lists (tenant_id, is_active);
CREATE INDEX idx_pricing_pl_dates ON pricing_price_lists (effective_from, effective_to);

CREATE INDEX idx_pricing_pla_tenant ON pricing_price_list_assignments (tenant_id);
CREATE INDEX idx_pricing_pla_lookup ON pricing_price_list_assignments (tenant_id, assignment_type, assignment_value);

CREATE INDEX idx_pricing_ple_list ON pricing_price_list_entries (price_list_id);
CREATE INDEX idx_pricing_ple_product ON pricing_price_list_entries (product_id);

CREATE INDEX idx_pricing_plet_entry ON pricing_price_list_entry_tiers (entry_id);

CREATE INDEX idx_pricing_outbox_pending ON pricing_outbox (status, created_at) WHERE status = 'PENDING';
CREATE INDEX idx_pricing_outbox_tenant ON pricing_outbox (tenant_id);
CREATE INDEX idx_pricing_outbox_seq ON pricing_outbox (sequence_num);

CREATE INDEX idx_pricing_pe_processed_at ON pricing_processed_events (processed_at);

CREATE INDEX idx_pricing_audit_lookup ON pricing_audit_trail (tenant_id, price_list_id, product_id);

COMMIT;
