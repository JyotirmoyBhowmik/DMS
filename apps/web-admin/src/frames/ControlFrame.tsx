import React, { useState, useMemo } from 'react';
import type { UserRole } from '../types';
import { useData } from '../context/DataContext';
import { FrameHeader } from '../components/FrameHeader';
import { AdminDashboard } from '../pages/admin/AdminDashboard';
import { PlatformMatrix } from '../pages/admin/PlatformMatrix';
import { UserManagement } from '../pages/admin/UserManagement';
import { TenantManagement } from '../pages/admin/TenantManagement';
import { SystemConfig } from '../pages/admin/SystemConfig';
import { TenantAdminPortal } from '../pages/admin/TenantAdminPortal';
import { SyncQueue } from '../pages/integration/SyncQueue';
import { ChannelFlagMatrix } from '../pages/admin/ChannelFlagMatrix';
import { EnterpriseHierarchy } from '../pages/admin/EnterpriseHierarchy';
import { SkuMappingManager } from '../pages/admin/SkuMappingManager';
import { CentralAdminHub } from '../pages/admin/CentralAdminHub';

interface ControlFrameProps {
  role: UserRole;
  initialTab?: string;
}

export const ControlFrame: React.FC<ControlFrameProps> = ({ role, initialTab = 'central-admin' }) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const { platformNodes, syncQueue, auditChain } = useData();

  const tabs = [
    { id: 'central-admin', label: 'Central Admin Hub', icon: '⚙️' },
    { id: 'dashboard', label: 'System Overview Dashboard', icon: '📊' },
    { id: 'hierarchy', label: 'Enterprise Scope Hierarchy', icon: '🌳' },
    { id: 'sku-mapping', label: 'Distributor SKU Mapping', icon: '🔀' },
    { id: 'platform-matrix', label: 'Platform 29-Node Matrix', icon: '🏛️' },
    { id: 'users', label: 'User & Role RBAC', icon: '👤' },
    { id: 'tenants', label: 'Multi-Tenant Isolation', icon: '🏢' },
    { id: 'tenant-portal', label: 'Tenant Self-Service Portal', icon: '⚙️' },
    { id: 'channel-flags', label: 'Channel Module Flags', icon: '🎛️' },
    { id: 'system-config', label: 'Feature Flags & Config', icon: '⚙️' },
    { id: 'sync-queue', label: 'Offline Sync Queue', icon: '🔄' },
  ];

  // Dynamic KPIs computed from DataContext
  const kpis = useMemo(() => {
    const online = platformNodes.filter(n => n.status === 'online' || n.status === 'HEALTHY').length;
    const pendingSync = syncQueue.filter(s => s.status !== 'SYNCHRONIZED').length;

    return [
      { label: 'Platform Status', value: `${online}/${platformNodes.length} ONLINE`, color: online === platformNodes.length ? '#15803D' : '#B45309' },
      { label: 'Sync Backlog', value: `${pendingSync} Pending`, color: pendingSync === 0 ? '#15803D' : '#B91C1C' },
      { label: 'Audit Chain', value: `${auditChain.length} BLOCKS`, color: '#0F172A' },
    ];
  }, [platformNodes, syncQueue, auditChain]);

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
        {activeTab === 'central-admin' && <CentralAdminHub role={role} />}
        {activeTab === 'dashboard' && <AdminDashboard role={role} />}
        {activeTab === 'hierarchy' && <EnterpriseHierarchy role={role} />}
        {activeTab === 'sku-mapping' && <SkuMappingManager role={role} />}
        {activeTab === 'platform-matrix' && <PlatformMatrix role={role} />}
        {activeTab === 'users' && <UserManagement role={role} />}
        {activeTab === 'tenants' && <TenantManagement role={role} />}
        {activeTab === 'tenant-portal' && <TenantAdminPortal />}
        {activeTab === 'channel-flags' && <ChannelFlagMatrix role={role} />}
        {activeTab === 'system-config' && <SystemConfig role={role} />}
        {activeTab === 'sync-queue' && <SyncQueue role={role} />}
      </div>
    </div>
  );
};
