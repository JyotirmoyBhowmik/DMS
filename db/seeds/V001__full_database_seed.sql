-- =============================================================================
-- Enterprise DMS & SFA Platform: Full Database Sample Seeder
-- Compatible with PostgreSQL 14+ / Neon Serverless Postgres
-- Tenant ID: '00000000-0000-0000-0000-000000000001'
-- =============================================================================

BEGIN;

-- ── 1. TENANTS & IDENTITY ──

INSERT INTO tenants (id, name, domain, status, created_at) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Global Distribution Corp', 'dms.global.com', 'ACTIVE', NOW()),
  ('00000000-0000-0000-0000-000000000002', 'Metro Wholesalers Ltd', 'metro.dms.com', 'ACTIVE', NOW()),
  ('00000000-0000-0000-0000-000000000003', 'Apex Logistics Inc', 'apex.logistics.com', 'SUSPENDED', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO roles (id, name, description, is_system) VALUES
  ('role-1', 'admin', 'Full system administrator with unrestricted platform access', true),
  ('role-2', 'agent', 'Sales force field representative with mobile SFA access', true),
  ('role-3', 'distributor', 'Distributor partner with inventory & order management', true),
  ('role-4', 'auditor', 'Read-only financial & audit log inspector', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, tenant_id, email, password_hash, status, last_login) VALUES
  ('usr-1', '00000000-0000-0000-0000-000000000001', 'admin@enterprise.com', '$2a$12$KIXp/4.0Y8S6g1Q7qQ8.e.qQ8e', 'ACTIVE', NOW() - INTERVAL '1 hour'),
  ('usr-2', '00000000-0000-0000-0000-000000000001', 'agent-001@enterprise.com', '$2a$12$KIXp/4.0Y8S6g1Q7qQ8.e.qQ8e', 'ACTIVE', NOW() - INTERVAL '3 hours'),
  ('usr-3', '00000000-0000-0000-0000-000000000001', 'distributor-metro@enterprise.com', '$2a$12$KIXp/4.0Y8S6g1Q7qQ8.e.qQ8e', 'ACTIVE', NOW() - INTERVAL '1 day'),
  ('usr-4', '00000000-0000-0000-0000-000000000001', 'auditor@enterprise.com', '$2a$12$KIXp/4.0Y8S6g1Q7qQ8.e.qQ8e', 'SUSPENDED', NOW() - INTERVAL '5 days'),
  ('usr-5', '00000000-0000-0000-0000-000000000001', 'agent-002@enterprise.com', '$2a$12$KIXp/4.0Y8S6g1Q7qQ8.e.qQ8e', 'ACTIVE', NOW() - INTERVAL '2 hours')
ON CONFLICT (id) DO NOTHING;

-- ── 2. DMS CORE: INVENTORY & OUTLETS ──

INSERT INTO products_skus (id, tenant_id, sku, name, category, price, min_threshold) VALUES
  ('sku-001', '00000000-0000-0000-0000-000000000001', 'SKU-FMCG-001', 'Sunflower Cooking Oil 1L', 'Cooking Oil', 12.50, 500),
  ('sku-002', '00000000-0000-0000-0000-000000000001', 'SKU-FMCG-002', 'Whole Wheat Flour 5kg', 'Grains', 8.90, 300),
  ('sku-003', '00000000-0000-0000-0000-000000000001', 'SKU-FMCG-003', 'Refined Sugar 2kg', 'Sweeteners', 3.20, 100),
  ('sku-004', '00000000-0000-0000-0000-000000000001', 'SKU-FMCG-004', 'Basmati Rice 5kg', 'Rice', 18.00, 200),
  ('sku-005', '00000000-0000-0000-0000-000000000001', 'SKU-FMCG-005', 'Organic Tea Leaves 500g', 'Beverages', 4.50, 100),
  ('sku-006', '00000000-0000-0000-0000-000000000001', 'SKU-FMCG-006', 'Premium Olive Oil 500ml', 'Cooking Oil', 22.00, 150)
ON CONFLICT (id) DO NOTHING;

INSERT INTO inventory_records (id, tenant_id, product_id, warehouse_id, stock) VALUES
  ('inv-001', '00000000-0000-0000-0000-000000000001', 'sku-001', 'WH-MAIN-01', 1420),
  ('inv-002', '00000000-0000-0000-0000-000000000001', 'sku-002', 'WH-MAIN-01', 240),
  ('inv-003', '00000000-0000-0000-0000-000000000001', 'sku-003', 'WH-MAIN-01', 85),
  ('inv-004', '00000000-0000-0000-0000-000000000001', 'sku-004', 'WH-MAIN-01', 620),
  ('inv-005', '00000000-0000-0000-0000-000000000001', 'sku-005', 'WH-MAIN-01', 45)
ON CONFLICT (id) DO NOTHING;

INSERT INTO retail_outlets (id, tenant_id, name, type, address, credit_limit, assigned_agent, status) VALUES
  ('out-1', '00000000-0000-0000-0000-000000000001', 'City Supermarket', 'Supermarket', '12 Main Street, Zone A', 50000, 'agent-001@enterprise.com', 'ACTIVE'),
  ('out-2', '00000000-0000-0000-0000-000000000001', 'Valley Grocery Mart', 'Kirana', '45 Valley Road, Zone B', 25000, 'agent-001@enterprise.com', 'ACTIVE'),
  ('out-3', '00000000-0000-0000-0000-000000000001', 'Corner Express Store', 'General Trade', '78 Park Ave, Zone C', 15000, 'agent-002@enterprise.com', 'ACTIVE'),
  ('out-4', '00000000-0000-0000-0000-000000000001', 'Metro Cash & Carry', 'Wholesaler', '99 Industrial Blvd, Zone A', 100000, 'agent-002@enterprise.com', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- ── 3. SFA: BEAT ROUTES & ORDERS ──

INSERT INTO beat_routes (id, tenant_id, code, name, agent, outlets_count, radius_km, status) VALUES
  ('beat-101', '00000000-0000-0000-0000-000000000001', 'BEAT-NORTH-01', 'Downtown Grocery Circuit', 'Agent Sarah Jenkins', 18, '2.5 km', 'ACTIVE'),
  ('beat-102', '00000000-0000-0000-0000-000000000001', 'BEAT-SOUTH-04', 'Valley Mart Express Route', 'Agent Mark Vance', 24, '4.0 km', 'ACTIVE'),
  ('beat-103', '00000000-0000-0000-0000-000000000001', 'BEAT-EAST-09', 'Commercial Hub Beat', 'Agent Elena Rostova', 12, '1.8 km', 'INACTIVE')
ON CONFLICT (id) DO NOTHING;

INSERT INTO sales_orders (id, tenant_id, outlet_name, agent_name, total_amount, items_count, status, created_at) VALUES
  ('ORD-2026-001', '00000000-0000-0000-0000-000000000001', 'City Supermarket', 'Agent Sarah Jenkins', '$1,450.00', 14, 'PENDING_APPROVAL', NOW()),
  ('ORD-2026-002', '00000000-0000-0000-0000-000000000001', 'Valley Grocery Mart', 'Agent Mark Vance', '$890.50', 8, 'APPROVED', NOW() - INTERVAL '2 hours'),
  ('ORD-2026-003', '00000000-0000-0000-0000-000000000001', 'Corner Express Store', 'Agent Elena Rostova', '$3,200.00', 32, 'PENDING_APPROVAL', NOW() - INTERVAL '4 hours')
ON CONFLICT (id) DO NOTHING;

-- ── 4. FINANCE: INVOICES & CLAIMS ──

INSERT INTO invoices (id, tenant_id, customer_name, amount, tax_amount, status, due_date) VALUES
  ('INV-2026-001', '00000000-0000-0000-0000-000000000001', 'Metro Wholesalers Ltd', '$14,250.00', '$1,140.00', 'PAID', '2026-08-15'),
  ('INV-2026-002', '00000000-0000-0000-0000-000000000001', 'Apex Logistics Inc', '$8,900.00', '$712.00', 'OVERDUE', '2026-07-28'),
  ('INV-2026-003', '00000000-0000-0000-0000-000000000001', 'Global Distribution Corp', '$22,100.00', '$1,768.00', 'PENDING', '2026-08-20')
ON CONFLICT (id) DO NOTHING;

INSERT INTO trade_claims (id, tenant_id, distributor, scheme, amount, status) VALUES
  ('CLM-2026-001', '00000000-0000-0000-0000-000000000001', 'Metro Wholesalers Ltd', 'Monsoon Oil Bulk Promotion', '$4,250.00', 'PENDING_APPROVAL'),
  ('CLM-2026-002', '00000000-0000-0000-0000-000000000001', 'Apex Logistics Inc', 'Retailer Festival Scheme', '$1,800.00', 'SETTLED')
ON CONFLICT (id) DO NOTHING;

-- ── 5. AUDIT & CONFIG ──

INSERT INTO audit_logs (id, tenant_id, block_number, action, user_id, hash, created_at) VALUES
  ('aud-1', '00000000-0000-0000-0000-000000000001', 1, 'TENANT_ONBOARDED', 'system_root', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', NOW() - INTERVAL '1 day'),
  ('aud-2', '00000000-0000-0000-0000-000000000001', 2, 'VAN_SALE_COMPLETED', 'agent-001', '4f9a08e178b0f209cd0c73be48bfcd32ab4826d9cf1e27a92fbcd821a8cd34a2', NOW() - INTERVAL '12 hours')
ON CONFLICT (id) DO NOTHING;

COMMIT;
