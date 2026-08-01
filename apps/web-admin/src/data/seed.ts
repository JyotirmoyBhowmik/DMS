// ── Demo Seed Data for Static Mode ──
// All sample data extracted from the monolithic main.tsx

import type {
  AppUser, Tenant, Role, Permission, MfaDevice,
  SkuItem, BeatRoute, SalesOrder, Invoice,
  FieldVisit, VanSale, TradeScheme, TradeClaim,
  AuditBlock, SyncTask, ConfigFlag, PlatformNode, Outlet, NavItem
} from '../types';

// ── Navigation Menu Items (role-filtered) ──

export const NAV_ITEMS: NavItem[] = [
  // Dashboard
  { id: 'dashboard', label: 'Dashboard', icon: '📊', section: 'OVERVIEW', roles: ['admin', 'agent', 'distributor', 'auditor'] },
  { id: 'platform-matrix', label: 'Platform Matrix', icon: '🏛️', section: 'OVERVIEW', roles: ['admin', 'auditor'] },

  // Identity & Access
  { id: 'users', label: 'User Management', icon: '👤', section: 'IDENTITY & ACCESS', roles: ['admin', 'auditor'] },
  { id: 'tenants', label: 'Tenant Management', icon: '🏢', section: 'IDENTITY & ACCESS', roles: ['admin'] },

  // Inventory & Master Data
  { id: 'sku-catalog', label: 'SKU Catalog', icon: '📦', section: 'INVENTORY', roles: ['admin', 'agent', 'distributor', 'auditor'] },
  { id: 'stock-ledger', label: 'Stock Ledger', icon: '📋', section: 'INVENTORY', roles: ['admin', 'distributor', 'auditor'] },
  { id: 'outlet-registry', label: 'Outlet Registry', icon: '🏪', section: 'INVENTORY', roles: ['admin', 'agent', 'auditor'] },

  // Sales & Field Operations
  { id: 'sales-orders', label: 'Sales Orders', icon: '🛒', section: 'SALES & FIELD OPS', roles: ['admin', 'agent', 'distributor', 'auditor'] },
  { id: 'beat-routes', label: 'Beat Routes', icon: '🗺️', section: 'SALES & FIELD OPS', roles: ['admin', 'agent'] },
  { id: 'field-visits', label: 'Field Visits', icon: '📍', section: 'SALES & FIELD OPS', roles: ['admin', 'agent', 'auditor'] },
  { id: 'van-sales', label: 'Van Sales', icon: '🚚', section: 'SALES & FIELD OPS', roles: ['admin', 'agent'] },

  // Finance & Claims
  { id: 'invoices', label: 'Invoices', icon: '📄', section: 'FINANCE', roles: ['admin', 'distributor', 'auditor'] },
  { id: 'trade-claims', label: 'Trade Claims', icon: '💰', section: 'FINANCE', roles: ['admin', 'distributor', 'auditor'] },
  { id: 'pricing-schemes', label: 'Pricing & Schemes', icon: '🏷️', section: 'FINANCE', roles: ['admin', 'agent', 'distributor', 'auditor'] },

  // Analytics & AI
  { id: 'ai-forecast', label: 'AI Forecast', icon: '⚡', section: 'ANALYTICS', roles: ['admin'] },
  { id: 'reports', label: 'Reports', icon: '📈', section: 'ANALYTICS', roles: ['admin', 'agent', 'distributor', 'auditor'] },

  // System & Security
  { id: 'audit-ledger', label: 'Audit Ledger', icon: '🛡️', section: 'SYSTEM', roles: ['admin', 'auditor'] },
  { id: 'system-config', label: 'System Config', icon: '⚙️', section: 'SYSTEM', roles: ['admin'] },
  { id: 'sync-queue', label: 'Sync Queue', icon: '🔄', section: 'SYSTEM', roles: ['admin', 'agent'] },
];

// ── Identity ──

export const SEED_USERS: AppUser[] = [
  { id: 'usr-1', email: 'admin@enterprise.com', status: 'ACTIVE', roles: 'admin', lastLogin: '2026-08-01 09:12' },
  { id: 'usr-2', email: 'agent-001@enterprise.com', status: 'ACTIVE', roles: 'agent', lastLogin: '2026-08-01 11:15' },
  { id: 'usr-3', email: 'distributor-metro@enterprise.com', status: 'ACTIVE', roles: 'distributor', lastLogin: '2026-07-31 18:44' },
  { id: 'usr-4', email: 'auditor@enterprise.com', status: 'SUSPENDED', roles: 'auditor', lastLogin: '2026-07-25 14:02' },
  { id: 'usr-5', email: 'agent-002@enterprise.com', status: 'ACTIVE', roles: 'agent', lastLogin: '2026-08-01 10:30' },
  { id: 'usr-6', email: 'distributor-apex@enterprise.com', status: 'ACTIVE', roles: 'distributor', lastLogin: '2026-07-30 16:20' },
];

export const SEED_TENANTS: Tenant[] = [
  { id: '00000000-0000-0000-0000-000000000001', name: 'Global Distribution Corp', status: 'ACTIVE', domain: 'dms.global.com' },
  { id: '00000000-0000-0000-0000-000000000002', name: 'Metro Wholesalers Ltd', status: 'ACTIVE', domain: 'metro.dms.com' },
  { id: '00000000-0000-0000-0000-000000000003', name: 'Apex Logistics Inc', status: 'SUSPENDED', domain: 'apex.logistics.com' },
];

export const SEED_ROLES: Role[] = [
  { id: 'role-1', name: 'admin', description: 'Full system administrator with unrestricted platform access', isSystem: true },
  { id: 'role-2', name: 'agent', description: 'Sales force field representative with mobile SFA access', isSystem: true },
  { id: 'role-3', name: 'distributor', description: 'Distributor partner with inventory & order management', isSystem: true },
  { id: 'role-4', name: 'auditor', description: 'Read-only financial & audit log inspector', isSystem: false },
];

export const SEED_PERMISSIONS: Permission[] = [
  { id: 'perm-1', name: 'orders:create', resource: 'orders', action: 'create', description: 'Submit new distributor sales orders' },
  { id: 'perm-2', name: 'inventory:update', resource: 'inventory', action: 'update', description: 'Adjust warehouse stock levels' },
  { id: 'perm-3', name: 'claims:approve', resource: 'claims', action: 'approve', description: 'Authorize trade promotion payouts' },
  { id: 'perm-4', name: 'identity:manage', resource: 'identity', action: 'manage', description: 'Create and modify users and roles' },
  { id: 'perm-5', name: 'reports:export', resource: 'reports', action: 'export', description: 'Generate and download CSV/PDF reports' },
  { id: 'perm-6', name: 'audit:verify', resource: 'audit', action: 'verify', description: 'Verify cryptographic block chain integrity' },
];

export const SEED_MFA_DEVICES: MfaDevice[] = [
  { id: 'mfa-1', userId: 'admin@enterprise.com', type: 'TOTP', isActive: true, lastUsedAt: '2026-08-01 09:12' },
  { id: 'mfa-2', userId: 'agent-001@enterprise.com', type: 'TOTP', isActive: true, lastUsedAt: '2026-08-01 11:15' },
  { id: 'mfa-3', userId: 'distributor-metro@enterprise.com', type: 'SMS', isActive: false, lastUsedAt: '2026-07-28 14:20' },
];

// ── DMS Core: Inventory ──

export const SEED_INVENTORY: SkuItem[] = [
  { sku: 'SKU-FMCG-001', name: 'Sunflower Cooking Oil 1L', category: 'Cooking Oil', stock: 1420, minThreshold: 500, price: 12.50, distributor: 'Metro Wholesalers Ltd' },
  { sku: 'SKU-FMCG-002', name: 'Whole Wheat Flour 5kg', category: 'Grains', stock: 240, minThreshold: 300, price: 8.90, distributor: 'Metro Wholesalers Ltd' },
  { sku: 'SKU-FMCG-003', name: 'Refined Sugar 2kg', category: 'Sweeteners', stock: 85, minThreshold: 100, price: 3.20, distributor: 'Apex Logistics Inc' },
  { sku: 'SKU-FMCG-004', name: 'Basmati Rice 5kg', category: 'Rice', stock: 620, minThreshold: 200, price: 18.00, distributor: 'Global Distribution Corp' },
  { sku: 'SKU-FMCG-005', name: 'Organic Tea Leaves 500g', category: 'Beverages', stock: 45, minThreshold: 100, price: 4.50, distributor: 'Global Distribution Corp' },
  { sku: 'SKU-FMCG-006', name: 'Premium Olive Oil 500ml', category: 'Cooking Oil', stock: 380, minThreshold: 150, price: 22.00, distributor: 'Metro Wholesalers Ltd' },
  { sku: 'SKU-FMCG-007', name: 'Instant Coffee Powder 200g', category: 'Beverages', stock: 560, minThreshold: 200, price: 6.80, distributor: 'Apex Logistics Inc' },
  { sku: 'SKU-FMCG-008', name: 'Soybean Oil 5L', category: 'Cooking Oil', stock: 90, minThreshold: 200, price: 14.50, distributor: 'Global Distribution Corp' },
];

export const SEED_OUTLETS: Outlet[] = [
  { id: 'out-1', name: 'City Supermarket', type: 'Supermarket', address: '12 Main Street, Zone A', creditLimit: 50000, assignedAgent: 'agent-001@enterprise.com', status: 'ACTIVE' },
  { id: 'out-2', name: 'Valley Grocery Mart', type: 'Kirana', address: '45 Valley Road, Zone B', creditLimit: 25000, assignedAgent: 'agent-001@enterprise.com', status: 'ACTIVE' },
  { id: 'out-3', name: 'Corner Express Store', type: 'General Trade', address: '78 Park Ave, Zone C', creditLimit: 15000, assignedAgent: 'agent-002@enterprise.com', status: 'ACTIVE' },
  { id: 'out-4', name: 'Metro Cash & Carry', type: 'Wholesaler', address: '99 Industrial Blvd, Zone A', creditLimit: 100000, assignedAgent: 'agent-002@enterprise.com', status: 'ACTIVE' },
  { id: 'out-5', name: 'Sunrise General Store', type: 'Kirana', address: '23 Hill St, Zone D', creditLimit: 10000, assignedAgent: 'agent-001@enterprise.com', status: 'INACTIVE' },
];

// ── SFA: Field Operations ──

export const SEED_BEAT_ROUTES: BeatRoute[] = [
  { id: 'beat-101', code: 'BEAT-NORTH-01', name: 'Downtown Grocery Circuit', agent: 'Agent Sarah Jenkins', outletsCount: 18, radiusKm: '2.5 km', status: 'ACTIVE' },
  { id: 'beat-102', code: 'BEAT-SOUTH-04', name: 'Valley Mart Express Route', agent: 'Agent Mark Vance', outletsCount: 24, radiusKm: '4.0 km', status: 'ACTIVE' },
  { id: 'beat-103', code: 'BEAT-EAST-09', name: 'Commercial Hub Beat', agent: 'Agent Elena Rostova', outletsCount: 12, radiusKm: '1.8 km', status: 'INACTIVE' },
  { id: 'beat-104', code: 'BEAT-WEST-02', name: 'Westside Cash & Carry Loop', agent: 'Agent Sarah Jenkins', outletsCount: 10, radiusKm: '3.2 km', status: 'ACTIVE' },
];

export const SEED_SALES_ORDERS: SalesOrder[] = [
  { id: 'ORD-2026-001', outlet: 'City Supermarket', agent: 'Agent Sarah Jenkins', totalAmount: '$1,450.00', items: 14, status: 'PENDING_APPROVAL', date: '2026-08-01 08:30' },
  { id: 'ORD-2026-002', outlet: 'Valley Grocery Mart', agent: 'Agent Mark Vance', totalAmount: '$890.50', items: 8, status: 'APPROVED', date: '2026-08-01 09:15' },
  { id: 'ORD-2026-003', outlet: 'Corner Express Store', agent: 'Agent Elena Rostova', totalAmount: '$3,200.00', items: 32, status: 'PENDING_APPROVAL', date: '2026-08-01 10:45' },
  { id: 'ORD-2026-004', outlet: 'Metro Cash & Carry', agent: 'Agent Sarah Jenkins', totalAmount: '$5,680.00', items: 45, status: 'DISPATCHED', date: '2026-07-31 14:20' },
  { id: 'ORD-2026-005', outlet: 'Sunrise General Store', agent: 'Agent Mark Vance', totalAmount: '$420.00', items: 6, status: 'DELIVERED', date: '2026-07-30 11:00' },
];

export const SEED_FIELD_VISITS: FieldVisit[] = [
  { id: 'vst-801', agent: 'Agent Sarah Jenkins', outlet: 'City Supermarket', time: '09:30 AM', status: 'CHECKED_IN' },
  { id: 'vst-802', agent: 'Agent Mark Vance', outlet: 'Valley Grocery Mart', time: '10:15 AM', status: 'COMPLETED' },
  { id: 'vst-803', agent: 'Agent Elena Rostova', outlet: 'Corner Express Store', time: '11:00 AM', status: 'IN_TRANSIT' },
  { id: 'vst-804', agent: 'Agent Sarah Jenkins', outlet: 'Metro Cash & Carry', time: '02:30 PM', status: 'COMPLETED' },
  { id: 'vst-805', agent: 'Agent Mark Vance', outlet: 'Sunrise General Store', time: '04:00 PM', status: 'MISSED' },
];

export const SEED_VAN_SALES: VanSale[] = [
  { id: 'vs-301', vanId: 'VAN-04', orderValue: '$1,450.00', itemsCount: 42, status: 'DELIVERED' },
  { id: 'vs-302', vanId: 'VAN-09', orderValue: '$890.50', itemsCount: 18, status: 'DISPATCHED' },
  { id: 'vs-303', vanId: 'VAN-12', orderValue: '$2,100.00', itemsCount: 55, status: 'LOADING' },
];

// ── Finance ──

export const SEED_INVOICES: Invoice[] = [
  { id: 'INV-2026-001', customer: 'Metro Wholesalers Ltd', amount: '$14,250.00', taxAmount: '$1,140.00', status: 'PAID', dueDate: '2026-08-15' },
  { id: 'INV-2026-002', customer: 'Apex Logistics Inc', amount: '$8,900.00', taxAmount: '$712.00', status: 'OVERDUE', dueDate: '2026-07-28' },
  { id: 'INV-2026-003', customer: 'Global Distribution Corp', amount: '$22,100.00', taxAmount: '$1,768.00', status: 'CREDIT_NOTE_ISSUED', dueDate: '2026-08-20' },
  { id: 'INV-2026-004', customer: 'Metro Wholesalers Ltd', amount: '$6,320.00', taxAmount: '$505.60', status: 'PENDING', dueDate: '2026-08-30' },
];

export const SEED_TRADE_SCHEMES: TradeScheme[] = [
  { id: 'sch-101', name: 'Monsoon Oil Bulk Promotion', type: 'VOLUME_DISCOUNT', validUntil: '2026-08-31', minQty: 50, reward: '10% Cash Back' },
  { id: 'sch-102', name: 'Retailer Festival Scheme', type: 'BUY_X_GET_Y', validUntil: '2026-09-15', minQty: 100, reward: '+5 Free Units' },
  { id: 'sch-103', name: 'New Outlet Onboarding Bonus', type: 'CASH_BACK', validUntil: '2026-10-01', minQty: 25, reward: '$200 Flat Cash Back' },
];

export const SEED_TRADE_CLAIMS: TradeClaim[] = [
  { id: 'CLM-2026-001', distributor: 'Metro Wholesalers Ltd', scheme: 'Monsoon Oil Bulk Promotion', amount: '$4,250.00', status: 'PENDING_APPROVAL' },
  { id: 'CLM-2026-002', distributor: 'Apex Logistics Inc', scheme: 'Retailer Festival Scheme', amount: '$1,800.00', status: 'SETTLED' },
  { id: 'CLM-2026-003', distributor: 'Global Distribution Corp', scheme: 'New Outlet Onboarding Bonus', amount: '$600.00', status: 'PENDING_APPROVAL' },
];

// ── Audit ──

export const SEED_AUDIT_CHAIN: AuditBlock[] = [
  { block: 1, action: 'TENANT_ONBOARDED', timestamp: '2026-07-31 10:00:24', hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', user: 'system_root' },
  { block: 2, action: 'VAN_SALE_COMPLETED', timestamp: '2026-07-31 11:14:52', hash: '4f9a08e178b0f209cd0c73be48bfcd32ab4826d9cf1e27a92fbcd821a8cd34a2', user: 'agent-001' },
  { block: 3, action: 'INVENTORY_REALLOCATED', timestamp: '2026-07-31 12:45:01', hash: '87ba8d234a9ef1c27a9cdbe4203da826dcd87b219fa82ebc829e12cd98c2ab48', user: 'distributor-metro' },
  { block: 4, action: 'CLAIM_APPROVED', timestamp: '2026-07-31 14:02:18', hash: 'a10b42fcd890eaef1c2bc7e42d87e0293ca8bdf76b92a4a75e2cdbc82ea8910b', user: 'admin@enterprise.com' },
  { block: 5, action: 'ORDER_DISPATCHED', timestamp: '2026-07-31 15:30:44', hash: 'c4d8e2f19a3b7c06d58e4af12b93d6a7e85f0c21d94a3b8e76f2c5d0a1b3e4f7', user: 'agent-002' },
];

// ── Integration ──

export const SEED_SYNC_QUEUE: SyncTask[] = [
  { id: 'sync-901', source: 'mobile-flutter', event: 'SFA_GEO_CHECKIN', status: 'SYNCHRONIZED', latency: '42ms' },
  { id: 'sync-902', source: 'mobile-rn', event: 'VAN_SALE_SUBMIT', status: 'SYNCHRONIZED', latency: '38ms' },
  { id: 'sync-903', source: 'distributor-portal', event: 'STOCK_LEDGER_SYNC', status: 'PROCESSING', latency: '120ms' },
  { id: 'sync-904', source: 'sap-erp-adapter', event: 'MASTER_DATA_IMPORT', status: 'SYNCHRONIZED', latency: '340ms' },
];

// ── Config ──

export const SEED_CONFIG_FLAGS: ConfigFlag[] = [
  { key: 'ENABLE_OFFLINE_SYNC_QUEUE', description: 'Enables mobile SQLite offline queueing & AES encryption', enabled: true },
  { key: 'ENFORCE_RLS_TENANT_ISOLATION', description: 'Sets Postgres app.current_tenant_id per query', enabled: true },
  { key: 'AUTO_APPROVE_LOW_VALUE_CLAIMS', description: 'Auto-authorizes claims under $500.00', enabled: false },
  { key: 'ENABLE_AI_DEMAND_FORECAST', description: 'Activates ML-based predictive demand engine', enabled: true },
  { key: 'ENABLE_VAN_SALES_MODULE', description: 'Shows van sales dispatch & mobile invoicing', enabled: true },
];

// ── Platform 29-Node Registry ──

export const SEED_PLATFORM_NODES: PlatformNode[] = [
  { name: 'identity-service', category: 'MICROSERVICE', status: 'HEALTHY', latency: '4ms', details: 'Authentication, Authorization, RBAC, JWKS & Tenant Management' },
  { name: 'dms-core-service', category: 'MICROSERVICE', status: 'HEALTHY', latency: '6ms', details: 'SKU Master Catalog, Inventory Ledger, Outlets & Distributors' },
  { name: 'sfa-service', category: 'MICROSERVICE', status: 'HEALTHY', latency: '5ms', details: 'Geofenced Check-Ins, Beat Routes, Van Sales & Merchandising' },
  { name: 'pricing-service', category: 'MICROSERVICE', status: 'HEALTHY', latency: '3ms', details: 'Channel Price Lists, Tiered Price Slabs & Customer Discounts' },
  { name: 'schemes-service', category: 'MICROSERVICE', status: 'HEALTHY', latency: '4ms', details: 'Trade Promotion Schemes, Buy-X-Get-Y & Volume Rewards' },
  { name: 'finance-service', category: 'MICROSERVICE', status: 'HEALTHY', latency: '5ms', details: 'Credit Limits, General Ledger, Credit Notes & Invoicing' },
  { name: 'claims-service', category: 'MICROSERVICE', status: 'HEALTHY', latency: '4ms', details: 'Distributor Trade Claims Submission, Verification & Settlement' },
  { name: 'file-service', category: 'MICROSERVICE', status: 'HEALTHY', latency: '7ms', details: 'AWS S3 Document Uploads, Photo Audits & Proof of Delivery' },
  { name: 'notification-service', category: 'MICROSERVICE', status: 'HEALTHY', latency: '3ms', details: 'FCM Mobile Push Notifications, SMS OTP & Email Alerts' },
  { name: 'audit-service', category: 'MICROSERVICE', status: 'HEALTHY', latency: '2ms', details: 'Immutable SHA-256 Blockchain Audit Log Ledger' },
  { name: 'config-service', category: 'MICROSERVICE', status: 'HEALTHY', latency: '2ms', details: 'Dynamic Feature Flags, App Configs & RLS Settings' },
  { name: 'report-service', category: 'MICROSERVICE', status: 'HEALTHY', latency: '8ms', details: 'PDF/CSV Secondary Sales Reports & Executive Analytics' },
  { name: 'integration-service', category: 'MICROSERVICE', status: 'HEALTHY', latency: '5ms', details: 'SAP, Tally & 3rd Party ERP Data Ingestion Adapters' },
  { name: 'sync-service', category: 'MICROSERVICE', status: 'HEALTHY', latency: '4ms', details: 'Mobile SQLite Offline Sync Queue & Conflict Resolution' },
  { name: 'forecasting-service', category: 'MICROSERVICE', status: 'HEALTHY', latency: '12ms', details: 'Predictive Demand Reordering Models & Seasonality Engines' },
  { name: 'recommendation-service', category: 'MICROSERVICE', status: 'HEALTHY', latency: '9ms', details: 'Next-Best-Action SKU Recommendations for Field Reps' },
  { name: 'ai-service', category: 'MICROSERVICE', status: 'HEALTHY', latency: '15ms', details: 'LLM Intelligent Agent & Natural Language Query Processor' },
  { name: 'api-gateway', category: 'GATEWAY', status: 'HEALTHY', latency: '2ms', details: 'Central Entry Point api.dms.jyotirmoyb.com & Rate Limiting' },
  { name: 'ai-gateway-service', category: 'GATEWAY', status: 'HEALTHY', latency: '3ms', details: 'Dedicated Gateway for High-Throughput AI Inference Requests' },
  { name: 'Monorepo', category: 'PLATFORM_PILLAR', status: 'STABLE', latency: 'pnpm-workspace', details: 'pnpm Workspace containing 34 packages, apps & microservices' },
  { name: 'Platform/Infra', category: 'PLATFORM_PILLAR', status: 'DEPLOYED', latency: 'Neon + Vercel', details: 'Neon PostgreSQL Serverless Cloud DB + Vercel Global Edge CDN' },
  { name: 'Multi-Tenancy', category: 'PLATFORM_PILLAR', status: 'ENFORCED', latency: 'Postgres RLS', details: 'Row-Level Security setting app.current_tenant_id per query' },
  { name: 'Globalization', category: 'PLATFORM_PILLAR', status: 'ENABLED', latency: 'i18n Multi-Currency', details: 'Multi-Currency (USD, INR, EUR) & UTC ISO-8601 Timestamps' },
  { name: 'web-admin', category: 'APPLICATION', status: 'LIVE', latency: 'dms.jyotirmoyb.com', details: 'Vite React Single Page Admin Dashboard (Executive White & Grey)' },
  { name: 'mobile-sfa', category: 'APPLICATION', status: 'COMPILED', latency: 'Flutter Android', details: 'Flutter Android SFA Field Rep App (com.dms.sfa APK)' },
  { name: 'Data & AI', category: 'PLATFORM_PILLAR', status: 'ACTIVE', latency: 'TensorFlow/PyTorch', details: 'Predictive Demand Forecasting & SKU Reordering Pipelines' },
  { name: 'Quality Program', category: 'PROGRAM', status: 'PASSED', latency: '96/98 Unit/Int', details: 'Triple-Layer Testing (Unit, Integration, API Contract Tests)' },
  { name: 'Security Program', category: 'PROGRAM', status: 'COMPLIANT', latency: 'AES-256 + RS256', details: 'JWT RS256 Tokens, AES-GCM Encrypted Storage & PII Redaction' },
  { name: 'Launch & Ops', category: 'PROGRAM', status: 'READY', latency: 'Production SLA 99.9%', details: 'Zero-Downtime CI/CD Pipeline & Automated Health Monitoring' },
];

// ── Dropdown option lists for forms ──

export const SKU_CATEGORIES = ['Cooking Oil', 'Grains', 'Sweeteners', 'Rice', 'Beverages', 'Dairy', 'Personal Care', 'Snacks'];
export const DISTRIBUTOR_NAMES = ['Metro Wholesalers Ltd', 'Global Distribution Corp', 'Apex Logistics Inc'];
export const AGENT_NAMES = ['Agent Sarah Jenkins', 'Agent Mark Vance', 'Agent Elena Rostova'];
export const GEOFENCE_RADII = ['1.5 km', '2.5 km', '3.0 km', '4.0 km', '5.0 km'];
export const OUTLET_TYPES: Outlet['type'][] = ['Kirana', 'Supermarket', 'Wholesaler', 'General Trade'];
