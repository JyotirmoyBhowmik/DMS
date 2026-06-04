-- =============================================================================
-- V010: Create outlet_census table for Sales Force Automation (SFA)
-- Captures outlet field data: KYC, classification, geo, competitor presence.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS outlet_census (
  id                        UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID           NOT NULL,
  outlet_id                 UUID           NOT NULL,
  agent_id                  UUID           NOT NULL,
  census_date               DATE           NOT NULL,
  outlet_name               VARCHAR(255)   NOT NULL,
  outlet_type               VARCHAR(30)    NOT NULL
                              CHECK (outlet_type IN ('kirana','supermarket','pharmacy','general')),
  owner_name                VARCHAR(255)   NOT NULL,
  owner_phone               VARCHAR(20)    NOT NULL,
  address                   TEXT           NOT NULL,
  geo_lat                   NUMERIC(10,7)  NOT NULL,
  geo_lng                   NUMERIC(10,7)  NOT NULL,
  photo_urls                TEXT[]         NOT NULL DEFAULT '{}',
  kyc_status                VARCHAR(20)    NOT NULL DEFAULT 'pending'
                              CHECK (kyc_status IN ('pending','verified','rejected')),
  gstin                     VARCHAR(15),
  pan_number                VARCHAR(10),
  trade_category            VARCHAR(100)   NOT NULL,
  annual_turnover_estimate  BIGINT         NOT NULL DEFAULT 0 CHECK (annual_turnover_estimate >= 0),
  competitor_presence       JSONB          NOT NULL DEFAULT '[]',
  status                    VARCHAR(20)    NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft','submitted','verified','approved','rejected')),
  created_at                TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ    NOT NULL DEFAULT now(),
  version                   INTEGER        NOT NULL DEFAULT 1
);

COMMENT ON TABLE outlet_census IS 'Field census data for retail outlets including KYC and trade classification';
COMMENT ON COLUMN outlet_census.annual_turnover_estimate IS 'Estimated annual turnover in smallest currency unit';
COMMENT ON COLUMN outlet_census.competitor_presence IS 'Array of competitor brand names observed at the outlet';
COMMENT ON COLUMN outlet_census.photo_urls IS 'File-service object keys for census photos';

-- Tenant-scoped indexes
CREATE INDEX idx_outlet_census_tenant       ON outlet_census (tenant_id);
CREATE INDEX idx_outlet_census_outlet       ON outlet_census (tenant_id, outlet_id);
CREATE INDEX idx_outlet_census_agent        ON outlet_census (tenant_id, agent_id);
CREATE INDEX idx_outlet_census_date         ON outlet_census (tenant_id, census_date DESC);
CREATE INDEX idx_outlet_census_type         ON outlet_census (tenant_id, outlet_type);
CREATE INDEX idx_outlet_census_kyc          ON outlet_census (tenant_id, kyc_status);
CREATE INDEX idx_outlet_census_status       ON outlet_census (tenant_id, status);
CREATE INDEX idx_outlet_census_competitors  ON outlet_census USING GIN (competitor_presence jsonb_path_ops);

CREATE TRIGGER outlet_census_set_updated_at
  BEFORE UPDATE ON outlet_census
  FOR EACH ROW
  EXECUTE FUNCTION trg_set_updated_at();

COMMIT;
