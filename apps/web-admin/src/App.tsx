// ── App Root: Frame-Wise Architecture + URL Hash Router + DataProvider ──

import React, { useState, useCallback, useMemo } from 'react';
import { HashRouter, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import type { UserRole, AppUser } from './types';
import { DataProvider, useData } from './context/DataContext';
import { Sidebar } from './components/Sidebar';
import { LandingPage } from './pages/landing/LandingPage';
import { tokens } from './theme/tokens';

// ── Frame Containers ──
import { DmsFrame } from './frames/DmsFrame';
import { SfaFrame } from './frames/SfaFrame';
import { GovernanceFrame } from './frames/GovernanceFrame';
import { AnalyticsFrame } from './frames/AnalyticsFrame';
import { ControlFrame } from './frames/ControlFrame';

export type FrameId = 'control' | 'dms' | 'sfa' | 'governance' | 'analytics';

interface FrameMeta {
  id: FrameId;
  label: string;
  icon: string;
  color: string;
  path: string;
  roles: UserRole[];
}

const FRAMES: FrameMeta[] = [
  { id: 'control', label: 'System Control Frame', icon: '🏛️', color: '#0F172A', path: '/control/dashboard', roles: ['admin', 'auditor'] },
  { id: 'dms', label: 'DMS Supply Chain Frame', icon: '🏢', color: '#1D4ED8', path: '/dms/sku-catalog', roles: ['admin', 'agent', 'distributor', 'auditor'] },
  { id: 'sfa', label: 'SFA Field Ops Frame', icon: '📍', color: '#15803D', path: '/sfa/sales-orders', roles: ['admin', 'agent'] },
  { id: 'governance', label: 'Financial Governance Frame', icon: '💰', color: '#B45309', path: '/governance/invoices', roles: ['admin', 'distributor', 'auditor'] },
  { id: 'analytics', label: 'AI & Analytics Frame', icon: '⚡', color: '#7C3AED', path: '/analytics/ai-forecast', roles: ['admin'] },
];

const MainAppLayout: React.FC<{
  isAuthenticated: boolean;
  isDemoMode: boolean;
  currentRole: UserRole;
  currentUser: AppUser | null;
  tenantName: string;
  isLiveApiMode: boolean;
  onLogin: (email: string, password: string, role: UserRole) => void;
  onDemoMode: () => void;
  onLogout: () => void;
  onRoleChange: (role: UserRole) => void;
  onTenantChange: (name: string) => void;
  onApiModeToggle: () => void;
}> = ({
  isAuthenticated,
  isDemoMode,
  currentRole,
  currentUser,
  tenantName,
  isLiveApiMode,
  onLogin,
  onDemoMode,
  onLogout,
  onRoleChange,
  onTenantChange,
  onApiModeToggle,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { tenants } = useData();

  // Determine active frame from URL pathname
  const activeFrame: FrameId = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith('/dms')) return 'dms';
    if (path.startsWith('/sfa')) return 'sfa';
    if (path.startsWith('/governance')) return 'governance';
    if (path.startsWith('/analytics')) return 'analytics';
    return 'control';
  }, [location.pathname]);

  // Determine active route ID for Sidebar
  const activeRoute = useMemo(() => {
    const parts = location.pathname.split('/');
    return parts[parts.length - 1] || 'dashboard';
  }, [location.pathname]);

  // Filter visible frames per role
  const visibleFrames = useMemo(() => {
    return FRAMES.filter((f) => f.roles.includes(currentRole));
  }, [currentRole]);

  // Pre-auth Landing Page
  if (!isAuthenticated) {
    return <LandingPage onLogin={onLogin} onDemoMode={onDemoMode} />;
  }

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: tokens.colors.bgApp,
        fontFamily: tokens.typography.fontFamily,
      }}
    >
      {/* Sidebar Navigation */}
      <Sidebar
        activeRoute={activeRoute as any}
        currentRole={currentRole}
        tenantName={tenantName}
        tenants={tenants.map((t) => ({ id: t.id, name: t.name }))}
        onNavigate={(routeId) => {
          // Route mapping to frame path
          const framePathMap: Record<string, string> = {
            dashboard: '/control/dashboard',
            'platform-matrix': '/control/platform-matrix',
            users: '/control/users',
            tenants: '/control/tenants',
            'system-config': '/control/system-config',
            'sync-queue': '/control/sync-queue',

            'sku-catalog': '/dms/sku-catalog',
            'stock-ledger': '/dms/stock-ledger',
            'outlet-registry': '/dms/outlet-registry',
            'pricing-schemes': '/dms/pricing-schemes',

            'sales-orders': '/sfa/sales-orders',
            'beat-routes': '/sfa/beat-routes',
            'field-visits': '/sfa/field-visits',
            'van-sales': '/sfa/van-sales',

            invoices: '/governance/invoices',
            'trade-claims': '/governance/trade-claims',
            'audit-ledger': '/governance/audit-ledger',

            'ai-forecast': '/analytics/ai-forecast',
            reports: '/analytics/reports',
          };
          const targetPath = framePathMap[routeId] || '/control/dashboard';
          navigate(targetPath);
        }}
        onTenantChange={onTenantChange}
      />

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top Header Bar */}
        <header
          style={{
            height: '64px',
            backgroundColor: tokens.colors.bgSurface,
            borderBottom: `1px solid ${tokens.colors.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 28px',
            flexShrink: 0,
            gap: '16px',
          }}
        >
          {/* Frame Switcher Bar */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {visibleFrames.map((f) => {
              const isActive = activeFrame === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => navigate(f.path)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 14px',
                    borderRadius: tokens.radii.lg,
                    border: isActive ? `2px solid ${f.color}` : `1px solid ${tokens.colors.border}`,
                    backgroundColor: isActive ? tokens.colors.bgSubtle : tokens.colors.bgSurface,
                    color: isActive ? f.color : tokens.colors.textMuted,
                    cursor: 'pointer',
                    fontSize: tokens.typography.fontSizeSm,
                    fontWeight: isActive ? tokens.typography.fontWeightBold : tokens.typography.fontWeightMedium,
                    transition: 'all 0.12s ease',
                  }}
                >
                  <span style={{ fontSize: '15px' }}>{f.icon}</span>
                  <span>{f.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            {/* Live API Mode Toggle */}
            <button
              onClick={onApiModeToggle}
              style={{
                padding: '6px 14px',
                borderRadius: tokens.radii.md,
                border: `1px solid ${tokens.colors.border}`,
                backgroundColor: isLiveApiMode ? tokens.colors.successBg : tokens.colors.bgApp,
                color: isLiveApiMode ? tokens.colors.success : tokens.colors.textMuted,
                cursor: 'pointer',
                fontSize: tokens.typography.fontSizeXs,
                fontWeight: tokens.typography.fontWeightSemibold,
              }}
            >
              {isLiveApiMode ? '🟢 Live API' : '📋 Reactive DB Store'}
            </button>

            {/* Role Selector */}
            <select
              value={currentRole}
              onChange={(e) => onRoleChange(e.target.value as UserRole)}
              style={{
                padding: '6px 10px',
                borderRadius: tokens.radii.md,
                border: `1px solid ${tokens.colors.border}`,
                backgroundColor: tokens.colors.bgSurface,
                fontSize: tokens.typography.fontSizeXs,
                fontWeight: tokens.typography.fontWeightSemibold,
                color: tokens.colors.textBody,
              }}
            >
              <option value="admin">👑 Admin</option>
              <option value="agent">📍 Agent</option>
              <option value="distributor">📦 Distributor</option>
              <option value="auditor">🛡️ Auditor</option>
            </select>

            {/* User Avatar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: tokens.radii.pill,
                  backgroundColor: tokens.colors.brandLight,
                  color: tokens.colors.brandDark,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: tokens.typography.fontWeightBold,
                  fontSize: tokens.typography.fontSizeSm,
                }}
              >
                {(currentUser?.email ?? 'U')[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: tokens.typography.fontSizeSm, fontWeight: tokens.typography.fontWeightSemibold, color: tokens.colors.textMain }}>
                  {currentUser?.email ?? 'User'}
                </div>
                <div style={{ fontSize: tokens.typography.fontSizeXs, color: tokens.colors.textMuted }}>
                  {isDemoMode ? 'Demo Mode' : 'Authenticated'}
                </div>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={onLogout}
              style={{
                padding: '6px 14px',
                borderRadius: tokens.radii.md,
                border: `1px solid ${tokens.colors.dangerBorder}`,
                backgroundColor: tokens.colors.dangerBg,
                color: tokens.colors.danger,
                cursor: 'pointer',
                fontSize: tokens.typography.fontSizeXs,
                fontWeight: tokens.typography.fontWeightSemibold,
              }}
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* Page Content Routes */}
        <main style={{ flex: 1, padding: '24px 28px', overflowY: 'auto' }}>
          <Routes>
            <Route path="/control/*" element={<ControlFrame role={currentRole} initialTab={activeRoute} />} />
            <Route path="/dms/*" element={<DmsFrame role={currentRole} initialTab={activeRoute} />} />
            <Route path="/sfa/*" element={<SfaFrame role={currentRole} initialTab={activeRoute} />} />
            <Route path="/governance/*" element={<GovernanceFrame role={currentRole} initialTab={activeRoute} />} />
            <Route path="/analytics/*" element={<AnalyticsFrame role={currentRole} initialTab={activeRoute} />} />
            <Route path="*" element={<Navigate to="/control/dashboard" replace />} />
          </Routes>
        </main>

        {/* Status Bar */}
        <footer
          style={{
            height: '28px',
            backgroundColor: tokens.colors.bgDark,
            color: tokens.colors.textLight,
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
            ● ROUTE: {location.pathname} │ Tenant: {tenantName} │ Role: {currentRole.toUpperCase()}
          </span>
          <span>
            19 Services HEALTHY │ React Router v6 URL Hash Routing
          </span>
        </footer>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [currentRole, setCurrentRole] = useState<UserRole>('admin');
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [tenantName, setTenantName] = useState('Global Distribution Corp');
  const [isLiveApiMode, setIsLiveApiMode] = useState(false);

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
  }, []);

  const handleLogout = useCallback(() => {
    setIsAuthenticated(false);
    setIsDemoMode(false);
    setCurrentUser(null);
    setCurrentRole('admin');
  }, []);

  return (
    <DataProvider>
      <HashRouter>
        <MainAppLayout
          isAuthenticated={isAuthenticated}
          isDemoMode={isDemoMode}
          currentRole={currentRole}
          currentUser={currentUser}
          tenantName={tenantName}
          isLiveApiMode={isLiveApiMode}
          onLogin={handleLogin}
          onDemoMode={handleDemoMode}
          onLogout={handleLogout}
          onRoleChange={(role) => setCurrentRole(role)}
          onTenantChange={(name) => setTenantName(name)}
          onApiModeToggle={() => setIsLiveApiMode(!isLiveApiMode)}
        />
      </HashRouter>
    </DataProvider>
  );
};
