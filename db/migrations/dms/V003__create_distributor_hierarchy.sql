-- =============================================================================
-- V003: Create distributor_hierarchy table
-- Tracks parent-child relationships in the distributor network.
-- Hierarchy levels: SUPER_STOCKIST > CNF > DISTRIBUTOR > SUB_DISTRIBUTOR
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS distributor_hierarchy (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID          NOT NULL,
  parent_distributor_id UUID          NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
  child_distributor_id  UUID          NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
  hierarchy_level       VARCHAR(30)   NOT NULL
                          CHECK (hierarchy_level IN ('SUPER_STOCKIST','CNF','DISTRIBUTOR','SUB_DISTRIBUTOR')),
  territory             VARCHAR(255)  NOT NULL,
  effective_from        DATE          NOT NULL,
  effective_to          DATE,
  is_active             BOOLEAN       NOT NULL DEFAULT true,
  version               INTEGER       NOT NULL DEFAULT 1,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),

  -- A distributor cannot be its own parent
  CONSTRAINT chk_no_self_reference CHECK (parent_distributor_id <> child_distributor_id),
  -- A child can only have one active parent per tenant
  CONSTRAINT uq_active_child UNIQUE (tenant_id, child_distributor_id) WHERE (is_active = true)
);

-- Indexes
CREATE INDEX idx_dh_tenant           ON distributor_hierarchy (tenant_id);
CREATE INDEX idx_dh_parent           ON distributor_hierarchy (tenant_id, parent_distributor_id);
CREATE INDEX idx_dh_child            ON distributor_hierarchy (tenant_id, child_distributor_id);
CREATE INDEX idx_dh_level            ON distributor_hierarchy (tenant_id, hierarchy_level);
CREATE INDEX idx_dh_territory        ON distributor_hierarchy (tenant_id, territory);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trg_dh_updated_at
  BEFORE UPDATE ON distributor_hierarchy
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
