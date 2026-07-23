-- Migration V041: Add SlabReward constraints, indexes, RLS policies, and optimistic locking version column

CREATE TABLE IF NOT EXISTS slab_rewards (
  id VARCHAR(255) PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,
  scheme_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  slab_code VARCHAR(255) NOT NULL,
  min_qualifying_qty INT NOT NULL DEFAULT 1,
  reward_type VARCHAR(50) NOT NULL DEFAULT 'CASHBACK',
  reward_value_cents BIGINT NOT NULL DEFAULT 0,
  reward_sku_id VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_slab_rewards_code UNIQUE (tenant_id, scheme_id, slab_code)
);

-- Constraints enforcing non-negative min qualifying qty & reward value
ALTER TABLE IF EXISTS slab_rewards
  DROP CONSTRAINT IF EXISTS chk_slab_rewards_non_negative_values;
ALTER TABLE IF EXISTS slab_rewards
  ADD CONSTRAINT chk_slab_rewards_non_negative_values CHECK (min_qualifying_qty >= 0 AND reward_value_cents >= 0);

-- Indexes for performance and common filters
CREATE INDEX IF NOT EXISTS idx_slab_rewards_tenant_status ON slab_rewards (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_slab_rewards_tenant_scheme ON slab_rewards (tenant_id, scheme_id);

-- Row-Level Security Policy
ALTER TABLE slab_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS slab_rewards_tenant_isolation_policy ON slab_rewards;
CREATE POLICY slab_rewards_tenant_isolation_policy ON slab_rewards
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));
