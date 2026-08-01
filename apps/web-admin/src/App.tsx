// ── App Root: Auth Gate + Hash Router + Layout ──

import React, { useState, useCallback, useMemo } from 'react';
import type { UserRole, RouteId, AppUser } from './types';
import { SEED_TENANTS } from './data/seed';
import { Sidebar } from './components/Sidebar';
import { LandingPage } from './pages/landing/LandingPage';

// ── Lazy page imports (avoids circular deps, keeps bundle clean) ──
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { UserManagement } from './pages/admin/UserManagement';
import { TenantManagement } from './pages/admin/TenantManagement';
import { PlatformMatrix } from './pages/admin/PlatformMatrix';
import { AuditLedger } from './pages/admin/AuditLedger';
import { SystemConfig } from './pages/admin/SystemConfig';
import { SkuCatalog } from './pages/inventory/SkuCatalog';
import { StockLedger } from './pages/inventory/StockLedger';
import { OutletRegistry } from './pages/inventory/OutletRegistry';
import { SalesOrders } from './pages/sales/SalesOrders';
import { BeatRoutes } from './pages/sales/BeatRoutes';
import { FieldVisits } from './pages/sales/FieldVisits';
import { VanSales } from './pages/sales/VanSales';
import { Invoices } from './pages/finance/Invoices';
import { TradeClaims } from './pages/finance/TradeClaims';
import { PricingSchemes } from './pages/finance/PricingSchemes';
import { AiForecast } from './pages/analytics/AiForecast';
import { Reports } from './pages/analytics/Reports';
import { SyncQueue } from './pages/integration/SyncQueue';

// ── Route → Component Map ──

const ROUTE_TITLES: Record<RouteId, string> = {
  dashboard: 'Dashboard',
  'platform-matrix': 'Platform Architecture Matrix',
  users: 'User Management',
  tenants: 'Tenant Management',
  'sku-catalog': 'SKU Catalog',
  'stock-ledger': 'Stock Ledger',
  'outlet-registry': 'Outlet Registry',
  'sales-orders': 'Sales Orders',
  'beat-routes': 'Beat Routes',
  'field-visits': 'Field Visits',
  'van-sales': 'Van Sales',
  invoices: 'Invoice Ledger',
  'trade-claims': 'Trade Claims',
  'pricing-schemes': 'Pricing & Schemes',
  'ai-forecast': 'AI Demand Forecast',
  reports: 'Reports & Analytics',
  'audit-ledger': 'Audit Ledger',
  'system-config': 'System Configuration',
  'sync-queue': 'Sync Queue',
};

export const App: React.FC = () => {
  // ── Auth State ──
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [currentRole, setCurrentRole] = useState<UserRole>('admin');
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);

  // ── App State ──
  const [activeRoute, setActiveRoute] = useState<RouteId>('dashboard');
  const [tenantName, setTenantName] = useState('Global Distribution Corp');
  const [isLiveApiMode, setIsLiveApiMode] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(new Date().toLocaleTimeString());

  // ── Auth Actions ──
  const handleLogin = useCallback((email: string, _password: string, role: UserRole) => {
    const user: AppUser = {
      id: `usr-${Date.now()}`,
      email,
      status: 'ACTIVE',
      roles: role,
      lastLogin: new Date().toISOString(),
    };
    setCurrentUser(user);
    setCurrentRole(role);
    setIsAuthenticated(true);
    setIsDemoMode(false);
    setActiveRoute('dashboard');
  }, []);

  const handleDemoMode = useCallback(() => {
    const demoUser: AppUser = {
      id: 'demo-admin-001',
      email: 'admin@enterprise.com',
      status: 'ACTIVE',
      roles: 'admin',
      lastLogin: new Date().toISOString(),
    };
    setCurrentUser(demoUser);
    setCurrentRole('admin');
    setIsAuthenticated(true);
    setIsDemoMode(true);
    setActiveRoute('dashboard');
  }, []);

  const handleLogout = useCallback(() => {
    setIsAuthenticated(false);
    setIsDemoMode(false);
    setCurrentUser(null);
    setCurrentRole('admin');
    setActiveRoute('dashboard');
  }, []);

  const handleRefresh = useCallback(() => {
    setLastRefreshed(new Date().toLocaleTimeString());
  }, []);

  // ── Render Route ──
  const routeContent = useMemo(() => {
    const props = { role: currentRole };
    switch (activeRoute) {
      case 'dashboard': return <AdminDashboard {...props} />;
      case 'platform-matrix': return <PlatformMatrix {...props} />;
      case 'users': return <UserManagement {...props} />;
      case 'tenants': return <TenantManagement {...props} />;
      case 'sku-catalog': return <SkuCatalog {...props} />;
      case 'stock-ledger': return <StockLedger {...props} />;
      case 'outlet-registry': return <OutletRegistry {...props} />;
      case 'sales-orders': return <SalesOrders {...props} />;
      case 'beat-routes': return <BeatRoutes {...props} />;
      case 'field-visits': return <FieldVisits {...props} />;
      case 'van-sales': return <VanSales {...props} />;
      case 'invoices': return <Invoices {...props} />;
      case 'trade-claims': return <TradeClaims {...props} />;
      case 'pricing-schemes': return <PricingSchemes {...props} />;
      case 'ai-forecast': return <AiForecast {...props} />;
      case 'reports': return <Reports {...props} />;
      case 'audit-ledger': return <AuditLedger {...props} />;
      case 'system-config': return <SystemConfig {...props} />;
      case 'sync-queue': return <SyncQueue {...props} />;
      default: return <AdminDashboard {...props} />;
    }
  }, [activeRoute, currentRole]);

  // ── Pre-Auth: Landing Page ──
  if (!isAuthenticated) {
    return <LandingPage onLogin={handleLogin} onDemoMode={handleDemoMode} />;
  }

  // ── Post-Auth: App Shell ──
  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: '#F8FAFC',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Sidebar */}
      <Sidebar
        activeRoute={activeRoute}
        currentRole={currentRole}
        tenantName={tenantName}
        tenants={SEED_TENANTS.map((t) => ({ id: t.id, name: t.name }))}
        onNavigate={setActiveRoute}
        onTenantChange={setTenantName}
      />

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top Header Bar */}
        <header
          style={{
            height: '60px',
            backgroundColor: '#FFFFFF',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 28px',
            flexShrink: 0,
          }}
        >
          <div>
            <h1 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A', margin: 0 }}>
              {ROUTE_TITLES[activeRoute] ?? 'Dashboard'}
            </h1>
            <p style={{ fontSize: '11px', color: '#64748B', margin: '2px 0 0' }}>
              {tenantName} • Last refreshed {lastRefreshed}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* API Mode Toggle */}
            <button
              onClick={() => setIsLiveApiMode(!isLiveApiMode)}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: '1px solid #E2E8F0',
                backgroundColor: isLiveApiMode ? '#DCFCE7' : '#F8FAFC',
                color: isLiveApiMode ? '#15803D' : '#64748B',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: '600',
              }}
            >
              {isLiveApiMode ? '🟢 Live API' : '📋 Static Demo'}
            </button>

            {/* Role Switcher */}
            <select
              value={currentRole}
              onChange={(e) => setCurrentRole(e.target.value as UserRole)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #E2E8F0',
                backgroundColor: '#FFFFFF',
                fontSize: '11px',
                fontWeight: '600',
                color: '#334155',
              }}
            >
              <option value="admin">👑 Admin</option>
              <option value="agent">📍 Agent</option>
              <option value="distributor">📦 Distributor</option>
              <option value="auditor">🛡️ Auditor</option>
            </select>

            {/* Refresh */}
            <button
              onClick={handleRefresh}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #E2E8F0',
                backgroundColor: '#FFFFFF',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              🔄
            </button>

            {/* User Menu */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '30px', height: '30px', borderRadius: '50%',
                  backgroundColor: '#EFF6FF', color: '#1D4ED8',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: '700', fontSize: '12px',
                }}
              >
                {(currentUser?.email ?? 'U')[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#0F172A' }}>
                  {currentUser?.email ?? 'User'}
                </div>
                <div style={{ fontSize: '10px', color: '#64748B' }}>
                  {isDemoMode ? 'Demo Mode' : 'Authenticated'}
                </div>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: '1px solid #FCA5A5',
                backgroundColor: '#FEF2F2',
                color: '#B91C1C',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: '600',
              }}
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main style={{ flex: 1, padding: '24px 28px', overflowY: 'auto' }}>
          {routeContent}
        </main>

        {/* Status Bar */}
        <footer
          style={{
            height: '28px',
            backgroundColor: '#0F172A',
            color: '#94A3B8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 28px',
            fontSize: '10px',
            fontFamily: 'monospace',
            flexShrink: 0,
          }}
        >
          <span>
            ● SYSTEM {isLiveApiMode ? 'LIVE' : 'DEMO'} │ Tenant: {tenantName} │ Role: {currentRole.toUpperCase()} │ Route: {activeRoute}
          </span>
          <span>
            19 Services HEALTHY │ 29/29 Nodes ONLINE │ Build STABLE │ dms.jyotirmoyb.com
          </span>
        </footer>
      </div>
    </div>
  );
};
