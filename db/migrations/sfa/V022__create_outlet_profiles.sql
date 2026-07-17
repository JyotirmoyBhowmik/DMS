-- =============================================================================
-- V022: Create outlet_profiles table for Sales Force Automation (SFA)
-- Enforces row-level security (RLS) and constraints for coordinates range.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS outlet_profiles (
  id                        UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID           NOT NULL,
  outlet_name               VARCHAR(255)   NOT NULL,
  outlet_type               VARCHAR(30)    NOT NULL CHECK (outlet_type IN ('kirana','supermarket','pharmacy','general')),
  owner_name                VARCHAR(255)   NOT NULL,
  owner_phone               VARCHAR(20)    NOT NULL,
  address                   TEXT           NOT NULL,
  geo_lat                   NUMERIC(10,7)  NOT NULL,
  geo_lng                   NUMERIC(10,7)  NOT NULL,
  kyc_status                VARCHAR(20)    NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending','verified','rejected')),
  status                    VARCHAR(20)    NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at                TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ    NOT NULL DEFAULT now(),
  version                   INTEGER        NOT NULL DEFAULT 1,
  CONSTRAINT geo_coords_valid CHECK (geo_lat BETWEEN -90 AND 90 AND geo_lng BETWEEN -180 AND 180)
);

COMMENT ON TABLE outlet_profiles IS 'Finalized retail outlet profiles including location, KYC status, and activity status';

-- Enable Row Level Security
ALTER TABLE outlet_profiles ENABLE ROW LEVEL SECURITY;

-- Attach tenant isolation policy
DROP POLICY IF EXISTS outlet_profiles_tenant_isolation ON outlet_profiles;
CREATE POLICY outlet_profiles_tenant_isolation ON outlet_profiles
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- Indexes for querying
CREATE INDEX idx_outlet_profiles_tenant ON outlet_profiles (tenant_id);
CREATE INDEX idx_outlet_profiles_status ON outlet_profiles (tenant_id, status);

COMMIT;
