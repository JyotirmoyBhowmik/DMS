-- V007: User organizational scope (customer → distributor → outlet)
CREATE TABLE IF NOT EXISTS identity_user_scopes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID         NOT NULL,
  user_id           UUID         NOT NULL,
  org_type          VARCHAR(32)  NOT NULL DEFAULT 'CUSTOMER',
  persona           VARCHAR(64)  NOT NULL DEFAULT 'field_agent',
  distributor_ids   UUID[]       NOT NULL DEFAULT '{}',
  outlet_ids        UUID[]       NOT NULL DEFAULT '{}',
  territory_ids     TEXT[]       NOT NULL DEFAULT '{}',
  module_entitlements TEXT[]     NOT NULL DEFAULT '{}',
  sync_profile      VARCHAR(32)  NOT NULL DEFAULT 'field_full',
  data_clearance    VARCHAR(32)  NOT NULL DEFAULT 'INTERNAL',
  erp_connector_id  UUID,
  version           INT          NOT NULL DEFAULT 1,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_scope_per_user UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_identity_user_scopes_tenant ON identity_user_scopes (tenant_id);

ALTER TABLE identity_user_scopes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_identity_user_scopes ON identity_user_scopes;
CREATE POLICY tenant_isolation_identity_user_scopes ON identity_user_scopes
  FOR ALL
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
