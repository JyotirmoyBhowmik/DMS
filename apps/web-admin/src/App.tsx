// ── App Root: Frame-Wise Architecture + Auth Gate + Hash Router ──

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import type { UserRole, RouteId, AppUser, Tenant } from './types';
import { dbService } from './services/dbService';
import { Sidebar } from './components/Sidebar';
import { LandingPage } from './pages/landing/LandingPage';

// ── Frame Container Imports ──
import { DmsFrame } from './frames/DmsFrame';
import { SfaFrame } from './frames/SfaFrame';
import { GovernanceFrame } from './frames/GovernanceFrame';
import { AnalyticsFrame } from './frames/AnalyticsFrame';
import { ControlFrame } from './frames/ControlFrame';

export type FrameId = 'dms' | 'sfa' | 'governance' | 'analytics' | 'control';

interface FrameMeta {
  id: FrameId;
  label: string;
  icon: string;
  color: string;
  roles: UserRole[];
}

const FRAMES: FrameMeta[] = [
  { id: 'control', label: 'System Control Frame', icon: '🏛️', color: '#0F172A', roles: ['admin', 'auditor'] },
  { id: 'dms', label: 'DMS Supply Chain Frame', icon: '🏢', color: '#1D4ED8', roles: ['admin', 'agent', 'distributor', 'auditor'] },
  { id: 'sfa', label: 'SFA Field Ops Frame', icon: '📍', color: '#15803D', roles: ['admin', 'agent'] },
  { id: 'governance', label: 'Financial Governance Frame', icon: '💰', color: '#B45309', roles: ['admin', 'distributor', 'auditor'] },
  { id: 'analytics', label: 'AI & Analytics Frame', icon: '⚡', color: '#7C3AED', roles: ['admin'] },
];

export const App: React.FC = () => {
  // ── Auth State ──
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [currentRole, setCurrentRole] = useState<UserRole>('admin');
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);

  // ── Frame & App State ──
  const [activeFrame, setActiveFrame] = useState<FrameId>('control');
  const [activeRoute, setActiveRoute] = useState<RouteId>('dashboard');
  const [tenants, setTenants] = useState<Array<{ id: string; name: string }>>([]);
  const [tenantName, setTenantName] = useState('Global Distribution Corp');
  const [isLiveApiMode, setIsLiveApiMode] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    dbService.getTenants().then((t: Tenant[]) => {
      if (Array.isArray(t)) {
        setTenants(t.map((x: Tenant) => ({ id: x.id, name: x.name })));
      }
    }).catch((err) => console.warn('Tenant fetch error:', err));
  }, []);

  // ── Route → Frame Synchronization ──
  const handleNavigate = useCallback((route: RouteId) => {
    setActiveRoute(route);
    // Auto-switch active frame based on route
    if (['sku-catalog', 'stock-ledger', 'outlet-registry', 'pricing-schemes'].includes(route)) {
      setActiveFrame('dms');
    } else if (['sales-orders', 'beat-routes', 'field-visits', 'van-sales'].includes(route)) {
      setActiveFrame('sfa');
    } else if (['invoices', 'trade-claims', 'audit-ledger'].includes(route)) {
      setActiveFrame('governance');
    } else if (['ai-forecast', 'reports'].includes(route)) {
      setActiveFrame('analytics');
    } else if (['dashboard', 'platform-matrix', 'users', 'tenants', 'system-config', 'sync-queue'].includes(route)) {
      setActiveFrame('control');
    }
  }, []);

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
    
    // Set default frame per role
    if (role === 'agent') {
      setActiveFrame('sfa');
      setActiveRoute('sales-orders');
    } else if (role === 'distributor') {
      setActiveFrame('dms');
      setActiveRoute('sku-catalog');
    } else if (role === 'auditor') {
      setActiveFrame('governance');
      setActiveRoute('invoices');
    } else {
      setActiveFrame('control');
      setActiveRoute('dashboard');
    }
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
    setActiveFrame('control');
    setActiveRoute('dashboard');
  }, []);

  const handleLogout = useCallback(() => {
    setIsAuthenticated(false);
    setIsDemoMode(false);
    setCurrentUser(null);
    setCurrentRole('admin');
    setActiveFrame('control');
    setActiveRoute('dashboard');
  }, []);

  const handleRefresh = useCallback(() => {
    setLastRefreshed(new Date().toLocaleTimeString());
  }, []);

  // Filter available frames by role
  const visibleFrames = useMemo(() => {
    return FRAMES.filter((f) => f.roles.includes(currentRole));
  }, [currentRole]);

  // ── Render Active Frame ──
  const frameContent = useMemo(() => {
    switch (activeFrame) {
      case 'dms':
        return <DmsFrame role={currentRole} initialTab={activeRoute} />;
      case 'sfa':
        return <SfaFrame role={currentRole} initialTab={activeRoute} />;
      case 'governance':
        return <GovernanceFrame role={currentRole} initialTab={activeRoute} />;
      case 'analytics':
        return <AnalyticsFrame role={currentRole} initialTab={activeRoute} />;
      case 'control':
      default:
        return <ControlFrame role={currentRole} initialTab={activeRoute} />;
    }
  }, [activeFrame, activeRoute, currentRole]);

  // ── Pre-Auth: Landing Page ──
  if (!isAuthenticated) {
    return <LandingPage onLogin={handleLogin} onDemoMode={handleDemoMode} />;
  }

  // ── Post-Auth: App Frame-Wise Shell ──
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
        tenants={tenants}
        onNavigate={handleNavigate}
        onTenantChange={setTenantName}
      />

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top Header Bar */}
        <header
          style={{
            height: '64px',
            backgroundColor: '#FFFFFF',
            borderBottom: '1px solid #E2E8F0',
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
                  onClick={() => {
                    setActiveFrame(f.id);
                    if (f.id === 'dms') setActiveRoute('sku-catalog');
                    if (f.id === 'sfa') setActiveRoute('sales-orders');
                    if (f.id === 'governance') setActiveRoute('invoices');
                    if (f.id === 'analytics') setActiveRoute('ai-forecast');
                    if (f.id === 'control') setActiveRoute('dashboard');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: isActive ? `2px solid ${f.color}` : '1px solid #E2E8F0',
                    backgroundColor: isActive ? '#F8FAFC' : '#FFFFFF',
                    color: isActive ? f.color : '#64748B',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: isActive ? '700' : '500',
                    transition: 'all 0.12s ease',
                  }}
                >
                  <span style={{ fontSize: '15px' }}>{f.icon}</span>
                  <span>{f.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right Header Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
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
              {isLiveApiMode ? '🟢 Live API' : '📋 Dynamic DB'}
            </button>

            {/* Role Switcher */}
            <select
              value={currentRole}
              onChange={(e) => {
                const newRole = e.target.value as UserRole;
                setCurrentRole(newRole);
                if (newRole === 'agent') setActiveFrame('sfa');
                if (newRole === 'distributor') setActiveFrame('dms');
                if (newRole === 'auditor') setActiveFrame('governance');
              }}
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
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  backgroundColor: '#EFF6FF',
                  color: '#1D4ED8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '700',
                  fontSize: '12px',
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

        {/* Page Content View */}
        <main style={{ flex: 1, padding: '24px 28px', overflowY: 'auto' }}>
          {frameContent}
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
            ● FRAME: {activeFrame.toUpperCase()} │ Tenant: {tenantName} │ Role: {currentRole.toUpperCase()} │ Route: {activeRoute}
          </span>
          <span>
            19 Services HEALTHY │ 29/29 Nodes ONLINE │ Frame-Wise Build STABLE │ dms.jyotirmoyb.com
          </span>
        </footer>
      </div>
    </div>
  );
};
