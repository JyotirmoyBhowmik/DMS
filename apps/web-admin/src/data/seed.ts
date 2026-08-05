// ── Dynamic Database Data Provider ──
// All application domain data is dynamically fetched from database API endpoints.

import type { Outlet, NavItem } from '../types';
import { dbService } from '../services/dbService';

// ── Navigation Menu Items (Structural UI Configuration) ──

export const NAV_ITEMS: NavItem[] = [
  // Overview
  { id: 'dashboard', label: 'Dashboard Overview', icon: '📊', section: 'OVERVIEW', roles: ['admin', 'agent', 'distributor', 'auditor'] },
  { id: 'platform-matrix', label: 'Platform 29-Node Grid', icon: '🏛️', section: 'OVERVIEW', roles: ['admin', 'auditor'] },

  // Identity & Tenancy
  { id: 'users', label: 'User & Role RBAC', icon: '👤', section: 'IDENTITY & ACCESS', roles: ['admin', 'auditor'] },
  { id: 'tenants', label: 'Tenant Isolation', icon: '🏢', section: 'IDENTITY & ACCESS', roles: ['admin'] },
  { id: 'tenant-portal', label: 'Tenant Self-Service Portal', icon: '⚙️', section: 'IDENTITY & ACCESS', roles: ['admin', 'distributor'] },

  // DMS Engine (Distributors, Stock Flow, Billing, Secondary Sales)
  { id: 'sku-catalog', label: 'SKU Master Catalog', icon: '📦', section: 'DMS ENGINE (SUPPLY CHAIN)', roles: ['admin', 'agent', 'distributor', 'auditor'] },
  { id: 'stock-ledger', label: 'Stock & Warehouse Ledger', icon: '📋', section: 'DMS ENGINE (SUPPLY CHAIN)', roles: ['admin', 'distributor', 'auditor'] },
  { id: 'outlet-registry', label: 'Retailer & Credit Limits', icon: '🏪', section: 'DMS ENGINE (SUPPLY CHAIN)', roles: ['admin', 'agent', 'auditor'] },
  { id: 'invoices', label: 'Billing & Invoicing', icon: '📄', section: 'DMS ENGINE (SUPPLY CHAIN)', roles: ['admin', 'distributor', 'auditor'] },
  { id: 'pricing-schemes', label: 'Pricing & Scheme Control', icon: '🏷️', section: 'DMS ENGINE (SUPPLY CHAIN)', roles: ['admin', 'agent', 'distributor', 'auditor'] },
  { id: 'trade-claims', label: 'Distributor Trade Claims', icon: '💰', section: 'DMS ENGINE (SUPPLY CHAIN)', roles: ['admin', 'distributor', 'auditor'] },

  // SFA Engine (Field Sales, Visits, Beat Planning, Van Sales)
  { id: 'sales-orders', label: 'Field Order Collection', icon: '🛒', section: 'SFA ENGINE (FIELD SALES)', roles: ['admin', 'agent', 'distributor', 'auditor'] },
  { id: 'beat-routes', label: 'Beat & Route Planning', icon: '🗺️', section: 'SFA ENGINE (FIELD SALES)', roles: ['admin', 'agent'] },
  { id: 'field-visits', label: 'GPS Visit & Attendance', icon: '📍', section: 'SFA ENGINE (FIELD SALES)', roles: ['admin', 'agent', 'auditor'] },
  { id: 'van-sales', label: 'Van Sales & Dispatch', icon: '🚚', section: 'SFA ENGINE (FIELD SALES)', roles: ['admin', 'agent'] },

  // Analytics & Decision Insights
  { id: 'ai-forecast', label: 'AI Demand Forecast', icon: '⚡', section: 'ANALYTICS & AI', roles: ['admin'] },
  { id: 'reports', label: 'Sales & Territory Reports', icon: '📈', section: 'ANALYTICS & AI', roles: ['admin', 'agent', 'distributor', 'auditor'] },

  // System & Security
  { id: 'audit-ledger', label: 'Blockchain Audit Log', icon: '🛡️', section: 'SYSTEM & SECURITY', roles: ['admin', 'auditor'] },
  { id: 'system-config', label: 'Feature Flags & Config', icon: '⚙️', section: 'SYSTEM & SECURITY', roles: ['admin'] },
  { id: 'sync-queue', label: 'Offline Sync Queue', icon: '🔄', section: 'SYSTEM & SECURITY', roles: ['admin', 'agent'] },
];

// ── Dropdown options for UI forms ──
export const SKU_CATEGORIES = ['Cooking Oil', 'Grains', 'Sweeteners', 'Rice', 'Beverages', 'Dairy', 'Personal Care', 'Snacks'];
export const DISTRIBUTOR_NAMES = ['Metro Wholesalers Ltd', 'Global Distribution Corp', 'Apex Logistics Inc'];
export const AGENT_NAMES = ['Agent Sarah Jenkins', 'Agent Mark Vance', 'Agent Elena Rostova'];
export const GEOFENCE_RADII = ['1.5 km', '2.5 km', '3.0 km', '4.0 km', '5.0 km'];
export const OUTLET_TYPES: Outlet['type'][] = ['Kirana', 'Supermarket', 'Wholesaler', 'General Trade'];

// ── Re-export Database API client methods ──
export const fetchUsers = () => dbService.getUsers();
export const fetchTenants = () => dbService.getTenants();
export const fetchRoles = () => dbService.getRoles();
export const fetchInventory = () => dbService.getInventory();
export const fetchOutlets = () => dbService.getOutlets();
export const fetchBeatRoutes = () => dbService.getBeatRoutes();
export const fetchSalesOrders = () => dbService.getSalesOrders();
export const fetchFieldVisits = () => dbService.getFieldVisits();
export const fetchVanSales = () => dbService.getVanSales();
export const fetchInvoices = () => dbService.getInvoices();
export const fetchTradeClaims = () => dbService.getTradeClaims();
export const fetchTradeSchemes = () => dbService.getTradeSchemes();
export const fetchAuditChain = () => dbService.getAuditChain();
export const fetchSyncQueue = () => dbService.getSyncQueue();
export const fetchConfigFlags = () => dbService.getConfigFlags();
export const fetchPlatformNodes = () => dbService.getPlatformNodes();
