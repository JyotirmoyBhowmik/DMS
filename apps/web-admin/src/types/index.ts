// ── Shared TypeScript Types & Interfaces ──

export type UserRole = 'admin' | 'agent' | 'distributor' | 'auditor';

export interface AppUser {
  id: string;
  email: string;
  status: 'ACTIVE' | 'SUSPENDED';
  roles: UserRole;
  lastLogin: string;
}

export interface Tenant {
  id: string;
  name: string;
  status: 'ACTIVE' | 'SUSPENDED';
  domain: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
}

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  description: string;
}

export interface MfaDevice {
  id: string;
  userId: string;
  type: 'TOTP' | 'SMS';
  isActive: boolean;
  lastUsedAt: string;
}

export interface SkuItem {
  sku: string;
  name: string;
  category: string;
  stock: number;
  minThreshold: number;
  price: number;
  distributor: string;
}

export interface BeatRoute {
  id: string;
  code: string;
  name: string;
  agent: string;
  outletsCount: number;
  radiusKm: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export type OrderStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'DISPATCHED' | 'DELIVERED';

export interface SalesOrder {
  id: string;
  outlet: string;
  agent: string;
  totalAmount: string;
  items: number;
  status: OrderStatus;
  date: string;
}

export type InvoiceStatus = 'PAID' | 'OVERDUE' | 'CREDIT_NOTE_ISSUED' | 'PENDING';

export interface Invoice {
  id: string;
  customer: string;
  amount: string;
  taxAmount: string;
  status: InvoiceStatus;
  dueDate: string;
}

export interface FieldVisit {
  id: string;
  agent: string;
  outlet: string;
  time: string;
  status: 'CHECKED_IN' | 'COMPLETED' | 'IN_TRANSIT' | 'MISSED';
}

export interface VanSale {
  id: string;
  vanId: string;
  orderValue: string;
  itemsCount: number;
  status: 'DELIVERED' | 'DISPATCHED' | 'LOADING';
}

export interface TradeScheme {
  id: string;
  name: string;
  type: 'VOLUME_DISCOUNT' | 'BUY_X_GET_Y' | 'CASH_BACK';
  validUntil: string;
  minQty: number;
  reward: string;
}

export interface TradeClaim {
  id: string;
  distributor: string;
  scheme: string;
  amount: string;
  status: 'PENDING_APPROVAL' | 'SETTLED' | 'REJECTED';
}

export interface AuditBlock {
  block: number;
  action: string;
  timestamp: string;
  hash: string;
  user: string;
}

export interface SyncTask {
  id: string;
  source: string;
  event: string;
  status: 'SYNCHRONIZED' | 'PROCESSING' | 'FAILED';
  latency: string;
}

export interface ConfigFlag {
  key: string;
  description: string;
  enabled: boolean;
}

export interface PlatformNode {
  name: string;
  category: 'MICROSERVICE' | 'GATEWAY' | 'PLATFORM_PILLAR' | 'APPLICATION' | 'PROGRAM';
  status: string;
  latency: string;
  details: string;
}

export interface Outlet {
  id: string;
  name: string;
  type: 'Kirana' | 'Supermarket' | 'Wholesaler' | 'General Trade';
  address: string;
  creditLimit: number;
  assignedAgent: string;
  status: 'ACTIVE' | 'INACTIVE';
}

// ── Navigation & Routing ──

export type RouteId =
  | 'dashboard'
  | 'platform-matrix'
  | 'users'
  | 'tenants'
  | 'tenant-portal'
  | 'sku-catalog'
  | 'stock-ledger'
  | 'outlet-registry'
  | 'sales-orders'
  | 'beat-routes'
  | 'field-visits'
  | 'van-sales'
  | 'invoices'
  | 'trade-claims'
  | 'pricing-schemes'
  | 'ai-forecast'
  | 'reports'
  | 'audit-ledger'
  | 'system-config'
  | 'sync-queue';

export interface NavItem {
  id: RouteId;
  label: string;
  icon: string;
  section: string;
  roles: UserRole[];  // Which roles can see this menu item
}

// ── Auth Context ──

export interface AuthState {
  isAuthenticated: boolean;
  isDemoMode: boolean;
  currentUser: AppUser | null;
  currentRole: UserRole;
  tenantId: string;
}

// ── Column Definition for DataTable ──

export interface ColumnDef<T> {
  key: keyof T | string;
  header: string;
  width?: string;
  render?: (row: T) => React.ReactNode;
}
