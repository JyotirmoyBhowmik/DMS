-- =============================================================================
-- Demo Seed: Sample Tenant Data
-- Tenant UUID: '00000000-0000-0000-0000-000000000001'
-- =============================================================================

BEGIN;

-- 1. Create Sample Distributors
INSERT INTO distributors (id, tenant_id, name, region, credit_limit, balance) VALUES
  ('d5b3d68a-6b45-4a5f-9db1-d41ee04fe4a0', '00000000-0000-0000-0000-000000000001', 'North FMCG Distributors', 'Delhi-NCR', 10000000, 2500000), -- 100k limit, 25k outstanding
  ('d5b3d68a-6b45-4a5f-9db1-d41ee04fe4a1', '00000000-0000-0000-0000-000000000001', 'South Trading Corp', 'Bangalore-Central', 50000000, 0)
ON CONFLICT (id) DO NOTHING;

-- 2. Create Sample Products & SKUs
INSERT INTO products_skus (id, tenant_id, sku, name, category, price, min_threshold) VALUES
  ('p5b3d68a-6b45-4a5f-9db1-d41ee04fe5a0', '00000000-0000-0000-0000-000000000001', 'SKU-OIL-SUN1L', 'Sunflower Cooking Oil 1L', 'FMCG_Grocery', 15000, 15), -- ₹150.00
  ('p5b3d68a-6b45-4a5f-9db1-d41ee04fe5a1', '00000000-0000-0000-0000-000000000001', 'SKU-SUG-REF5K', 'Refined White Sugar 5KG', 'FMCG_Grocery', 24000, 10),  -- ₹240.00
  ('p5b3d68a-6b45-4a5f-9db1-d41ee04fe5a2', '00000000-0000-0000-0000-000000000001', 'SKU-SOAP-SAN100', 'Sandalwood Soap 100G', 'FMCG_PersonalCare', 4500, 20) -- ₹45.00
ON CONFLICT (tenant_id, sku) DO NOTHING;

-- 3. Create Sample Inventory
INSERT INTO inventory_records (id, tenant_id, product_id, warehouse_id, stock) VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'p5b3d68a-6b45-4a5f-9db1-d41ee04fe5a0', 'WH-DELHI-01', 120),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'p5b3d68a-6b45-4a5f-9db1-d41ee04fe5a1', 'WH-DELHI-01', 5), -- Low stock alert triggered (threshold = 10)
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'p5b3d68a-6b45-4a5f-9db1-d41ee04fe5a2', 'WH-DELHI-01', 300)
ON CONFLICT (tenant_id, product_id, warehouse_id) DO NOTHING;

-- 4. Create Sample Retail Outlets
INSERT INTO retail_outlets (id, tenant_id, name, latitude, longitude, radius_meters) VALUES
  ('o5b3d68a-6b45-4a5f-9db1-d41ee04fe6a0', '00000000-0000-0000-0000-000000000001', 'Gupta General Store', 12.9716, 77.5946, 50),
  ('o5b3d68a-6b45-4a5f-9db1-d41ee04fe6a1', '00000000-0000-0000-0000-000000000001', 'Super Bazar Outlet', 12.9780, 77.5900, 100)
ON CONFLICT (id) DO NOTHING;

COMMIT;
