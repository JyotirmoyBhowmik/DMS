-- V001: ERP connector registry per customer tenant
CREATE TABLE IF NOT EXISTS integration_erp_connectors (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID         NOT NULL,
  name                VARCHAR(128) NOT NULL,
  connector_type      VARCHAR(64)  NOT NULL,
  status              VARCHAR(32)  NOT NULL DEFAULT 'INACTIVE',
  vault_secret_path   VARCHAR(512) NOT NULL,
  entity_map_json     JSONB        NOT NULL DEFAULT '{}',
  version             INT          NOT NULL DEFAULT 1,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_erp_connector_name UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS integration_erp_sync_cursors (
  tenant_id           UUID         NOT NULL,
  connector_id        UUID         NOT NULL REFERENCES integration_erp_connectors(id) ON DELETE CASCADE,
  data_type           VARCHAR(64)  NOT NULL,
  cursor_value        TEXT,
  last_success_at     TIMESTAMPTZ,
  PRIMARY KEY (tenant_id, connector_id, data_type)
);

CREATE TABLE IF NOT EXISTS integration_erp_posting_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID         NOT NULL,
  connector_id        UUID         NOT NULL,
  idempotency_key     VARCHAR(256) NOT NULL,
  transaction_type    VARCHAR(64)  NOT NULL,
  source_id           UUID         NOT NULL,
  status              VARCHAR(32)  NOT NULL,
  response_json       JSONB,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_erp_posting_idempotency UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_erp_connectors_tenant ON integration_erp_connectors (tenant_id, status);

ALTER TABLE integration_erp_connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_erp_sync_cursors ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_erp_posting_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_integration_erp_connectors ON integration_erp_connectors;
CREATE POLICY tenant_isolation_integration_erp_connectors ON integration_erp_connectors
  FOR ALL
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

DROP POLICY IF EXISTS tenant_isolation_integration_erp_sync_cursors ON integration_erp_sync_cursors;
CREATE POLICY tenant_isolation_integration_erp_sync_cursors ON integration_erp_sync_cursors
  FOR ALL
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

DROP POLICY IF EXISTS tenant_isolation_integration_erp_posting_log ON integration_erp_posting_log;
CREATE POLICY tenant_isolation_integration_erp_posting_log ON integration_erp_posting_log
  FOR ALL
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
