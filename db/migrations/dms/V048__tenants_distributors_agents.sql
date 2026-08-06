-- Migration: V048__tenants_distributors_agents.sql
-- Description: Core Multi-Tenancy, Distributor Hierarchy, Sales Agents, Distributor SKU Catalog Mapping, Channel Feature Flags, and ERP Connections

-- 1. Tenants Table
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  subdomain VARCHAR(64) UNIQUE,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed Default System Tenant
INSERT INTO tenants (id, name, subdomain, status)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default System Tenant', 'default', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- 2. Distributors Table (Self-Referencing Tree Hierarchy)
CREATE TABLE IF NOT EXISTS distributors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  parent_distributor_id UUID REFERENCES distributors(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  level VARCHAR(32) NOT NULL DEFAULT 'DISTRIBUTOR', -- REGION, AREA, DISTRIBUTOR, DEPOT
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Sales Agents Table
CREATE TABLE IF NOT EXISTS sales_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  distributor_id UUID NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
  user_id UUID,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(64),
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  assigned_beat_route_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Distributor SKU Catalog Mapping Table (Override Price & Min Qty)
CREATE TABLE IF NOT EXISTS distributor_sku_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  distributor_id UUID NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
  sku_id UUID NOT NULL REFERENCES skus(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  override_price NUMERIC(10,2),
  min_order_qty INT DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, distributor_id, sku_id)
);

-- 5. Channel Feature Flags Table
CREATE TABLE IF NOT EXISTS channel_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel_type VARCHAR(64) NOT NULL, -- MART, HOTEL_RESTAURANT, SMALL_SHOP, VAN_OPERATOR, SALES_MARKETING_TEAM
  module_name VARCHAR(64) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, channel_type, module_name)
);

-- 6. ERP Connections Table (Zero Plaintext Secrets)
CREATE TABLE IF NOT EXISTS erp_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  erp_type VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DISCONNECTED',
  config JSONB DEFAULT '{}'::jsonb,
  secret_key_ref VARCHAR(255) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, erp_type)
);

-- 7. Add Row-Level Security
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE distributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE distributor_sku_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_connections ENABLE ROW LEVEL SECURITY;

-- 8. Create Indexes for High Performance Querying
CREATE INDEX IF NOT EXISTS idx_distributors_tenant_id ON distributors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sales_agents_tenant_dist ON sales_agents(tenant_id, distributor_id);
CREATE INDEX IF NOT EXISTS idx_sku_mapping_distributor ON distributor_sku_mapping(tenant_id, distributor_id);
CREATE INDEX IF NOT EXISTS idx_channel_flags_tenant ON channel_feature_flags(tenant_id, channel_type);
