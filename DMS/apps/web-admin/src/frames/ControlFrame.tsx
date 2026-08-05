import React, { useState } from 'react';
import type { UserRole } from '../types';
import { FrameHeader } from '../components/FrameHeader';
import { AdminDashboard } from '../pages/admin/AdminDashboard';
import { PlatformMatrix } from '../pages/admin/PlatformMatrix';
import { UserManagement } from '../pages/admin/UserManagement';
import { TenantManagement } from '../pages/admin/TenantManagement';
import { SystemConfig } from '../pages/admin/SystemConfig';
import { SyncQueue } from '../pages/integration/SyncQueue';

interface ControlFrameProps {
  role: UserRole;
  initialTab?: string;
}

export const ControlFrame: React.FC<ControlFrameProps> = ({ role, initialTab = 'dashboard' }) => {
  const [activeTab, setActiveTab] = useState(initialTab);

  const tabs = [
    { id: 'dashboard', label: 'System Overview Dashboard', icon: '📊' },
    { id: 'platform-matrix', label: 'Platform 29-Node Matrix', icon: '🏛️' },
    { id: 'users', label: 'User & Role RBAC', icon: '👤' },
    { id: 'tenants', label: 'Multi-Tenant Isolation', icon: '🏢' },
    { id: 'system-config', label: 'Feature Flags & Config', icon: '⚙️' },
    { id: 'sync-queue', label: 'Offline Sync Queue', icon: '🔄' },
  ];

  const kpis = [
    { label: 'Platform Status', value: '29/29 ONLINE', color: '#15803D' },
    { label: 'Avg Latency', value: '4ms', color: '#1D4ED8' },
    { label: 'Build Status', value: 'STABLE', color: '#0F172A' },
  ];

  return (
    <div>
      <FrameHeader
        frameTitle="System Control & Health Frame"
        frameSubtitle="Central administration, platform node monitoring, multi-tenant isolation rules, RBAC user access & configuration flags"
        frameIcon="🏛️"
        badgeText="SYSTEM CONTROL"
        badgeColor="#0F172A"
        kpis={kpis}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Frame Content View */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px' }}>
        {activeTab === 'dashboard' && <AdminDashboard role={role} />}
        {activeTab === 'platform-matrix' && <PlatformMatrix role={role} />}
        {activeTab === 'users' && <UserManagement role={role} />}
        {activeTab === 'tenants' && <TenantManagement role={role} />}
        {activeTab === 'system-config' && <SystemConfig role={role} />}
        {activeTab === 'sync-queue' && <SyncQueue role={role} />}
      </div>
    </div>
  );
};
