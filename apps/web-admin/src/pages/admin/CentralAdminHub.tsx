import React, { useState } from 'react';
import type { UserRole } from '../../types';
import { tokens } from '../../theme/tokens';

// Import Section Components
import { TenantManagement } from './TenantManagement';
import { DistributorHierarchy } from '../inventory/DistributorHierarchy';
import { UserManagement } from './UserManagement';
import { SkuCatalog } from '../inventory/SkuCatalog';
import { SkuMappingManager } from './SkuMappingManager';
import { ChannelFlagMatrix } from './ChannelFlagMatrix';
import { SystemConfig } from './SystemConfig';

export type AdminSectionId =
  | 'tenants'
  | 'distributors'
  | 'agents'
  | 'sku-catalog'
  | 'sku-mapping'
  | 'channel-flags'
  | 'erp-connections'
  | 'rbac';

interface SectionMeta {
  id: AdminSectionId;
  title: string;
  subtitle: string;
  icon: string;
  superAdminOnly?: boolean;
}

export const CentralAdminHub: React.FC<{ role: UserRole; initialSection?: AdminSectionId }> = ({
  role,
  initialSection = 'distributors',
}) => {
  const isSuperAdmin = role === 'admin';
  const defaultSection = isSuperAdmin ? 'tenants' : initialSection;
  const [activeSection, setActiveSection] = useState<AdminSectionId>(defaultSection);

  // ERP State for Section 6 Stub
  const [erpStatus, setErpStatus] = useState<'CONNECTED' | 'DISCONNECTED'>('CONNECTED');
  const [secretKeyRef, setSecretKeyRef] = useState('VERCEL_ERP_SAP_SECRET_KEY');
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncingErp, setSyncingErp] = useState(false);

  const sections: SectionMeta[] = [
    {
      id: 'tenants',
      title: '1. Tenant Management',
      subtitle: 'Platform tenant directory, tenant provisioning, suspend/reactivate',
      icon: '🏢',
      superAdminOnly: true,
    },
    {
      id: 'distributors',
      title: '2. Distributor Management',
      subtitle: 'Distributor hierarchy tree, credit limit defaults, channel settings',
      icon: '🏬',
    },
    {
      id: 'agents',
      title: '3. Sales Agent Management',
      subtitle: 'Sales representative accounts, distributor assignment, login access',
      icon: '👤',
    },
    {
      id: 'sku-catalog',
      title: '4. Master SKU Catalog',
      subtitle: 'Master product catalog & price list management',
      icon: '📦',
    },
    {
      id: 'sku-mapping',
      title: '4b. Distributor SKU Mapping',
      subtitle: 'Distributor-specific SKU mapping & price override manager',
      icon: '🔀',
    },
    {
      id: 'channel-flags',
      title: '5. Channel Module Configuration',
      subtitle: 'Feature-flag matrix per outlet channel type (Mart, Kirana, Van, HoReCa)',
      icon: '🎛️',
    },
    {
      id: 'erp-connections',
      title: '6. ERP Connection Settings',
      subtitle: 'Per-tenant ERP integration credentials reference & sync stub',
      icon: '🔌',
    },
    {
      id: 'rbac',
      title: '7. User & Role Governance',
      subtitle: 'RBAC role definitions, user permission matrix & security controls',
      icon: '🔐',
    },
  ];

  const visibleSections = sections.filter(s => !s.superAdminOnly || isSuperAdmin);

  const handleTestErpSync = async () => {
    setSyncingErp(true);
    setSyncMessage(null);
    try {
      const res = await fetch('/api/v1/erp/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ erpType: 'SAP_S4HANA', syncEntity: 'INVENTORY' }),
      });
      const json = await res.json();
      if (res.ok) {
        setSyncMessage(`✓ Sync Queued! Trace ID: ${json.correlationId}`);
      } else {
        setSyncMessage(`✕ Sync Error: ${json.error || 'Failed'}`);
      }
    } catch (_e) {
      setSyncMessage('✕ Sync Error: Network request failed');
    } finally {
      setSyncingErp(false);
    }
  };

  return (
    <div style={{ padding: '24px', backgroundColor: tokens.colors.bgApp, minHeight: '100vh', color: tokens.colors.textBody }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: tokens.colors.textMain, margin: 0 }}>
          Central Platform Administration Configuration Hub
        </h1>
        <p style={{ color: tokens.colors.textMuted, margin: '4px 0 0', fontSize: '14px' }}>
          Single coherent admin control panel for tenant provisioning, distributor hierarchy, sales agents, SKU mappings, channel flags, and ERP settings
        </p>
      </div>

      {/* Main Grid: Left Side-Nav Navigation Bar + Right Content Section */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '24px', alignItems: 'start' }}>
        {/* Left Side-Nav Navigation Bar */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: `1px solid ${tokens.colors.border}`, padding: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: tokens.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px', paddingLeft: '8px' }}>
            Admin Sections
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {visibleSections.map(sec => {
              const isActive = activeSection === sec.id;

              return (
                <button
                  key={sec.id}
                  onClick={() => setActiveSection(sec.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: isActive ? '#EFF6FF' : 'transparent',
                    color: isActive ? '#1D4ED8' : tokens.colors.textMain,
                    fontWeight: isActive ? 700 : 500,
                    fontSize: '13px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ fontSize: '16px' }}>{sec.icon}</span>
                  <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sec.title}
                  </div>
                  {sec.superAdminOnly && (
                    <span style={{ fontSize: '9px', fontWeight: 700, backgroundColor: '#FEF3C7', color: '#B45309', padding: '2px 6px', borderRadius: '4px' }}>
                      SUPER
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Content View */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: `1px solid ${tokens.colors.border}`, padding: '24px', minHeight: '600px' }}>
          {/* Section 1: Tenant Management (Platform-Admin Only) */}
          {activeSection === 'tenants' && (
            <div>
              {!isSuperAdmin ? (
                <div style={{ padding: '32px', textAlign: 'center', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px' }}>
                  <h3>🔒 Access Denied: Platform Super-Admin Only</h3>
                  <p>Tenant provisioning and multi-tenant management is restricted to platform super-administrators.</p>
                </div>
              ) : (
                <TenantManagement role={role} />
              )}
            </div>
          )}

          {/* Section 2: Distributor Management */}
          {activeSection === 'distributors' && <DistributorHierarchy role={role} />}

          {/* Section 3: Sales Representative & Agent Management */}
          {activeSection === 'agents' && <UserManagement role={role} />}

          {/* Section 4: Master SKU Catalog */}
          {activeSection === 'sku-catalog' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Master Tenant SKU Catalog</h3>
                <button
                  onClick={() => setActiveSection('sku-mapping')}
                  style={{ padding: '6px 12px', backgroundColor: tokens.colors.brand, color: '#FFFFFF', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Open Distributor SKU Mapping Manager →
                </button>
              </div>
              <SkuCatalog role={role} />
            </div>
          )}

          {/* Section 4b: Distributor SKU Mapping Manager */}
          {activeSection === 'sku-mapping' && <SkuMappingManager role={role} />}

          {/* Section 5: Channel Module Feature Flags */}
          {activeSection === 'channel-flags' && <ChannelFlagMatrix role={role} />}

          {/* Section 6: ERP Connection & Integration Settings */}
          {activeSection === 'erp-connections' && (
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px' }}>Section 6: ERP Connection & Integration Settings</h2>
              <p style={{ color: tokens.colors.textMuted, fontSize: '13px', margin: '0 0 20px' }}>
                Manage per-tenant ERP connection parameters (SAP S/4HANA, TallyPrime). Plaintext secrets are never stored in Neon database; only environment variable reference names are saved.
              </p>

              {syncMessage && (
                <div style={{ padding: '10px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, marginBottom: '16px', backgroundColor: syncMessage.includes('✓') ? '#DCFCE7' : '#FEE2E2', color: syncMessage.includes('✓') ? '#166534' : '#B91C1C' }}>
                  {syncMessage}
                </div>
              )}

              <div style={{ backgroundColor: '#F8FAFC', padding: '20px', borderRadius: '8px', border: `1px solid ${tokens.colors.border}`, width: '500px', maxWidth: '100%' }}>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>ERP Connection Status</label>
                  <select
                    value={erpStatus}
                    onChange={e => setErpStatus(e.target.value as any)}
                    style={{ width: '100%', padding: '8px 12px', border: `1px solid ${tokens.colors.border}`, borderRadius: '6px' }}
                  >
                    <option value="CONNECTED">✓ CONNECTED (Active Integration)</option>
                    <option value="DISCONNECTED">✕ DISCONNECTED (Standby)</option>
                  </select>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Secret Key Reference Name (Vercel Encrypted Env Var)</label>
                  <input
                    type="text"
                    value={secretKeyRef}
                    onChange={e => setSecretKeyRef(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', border: `1px solid ${tokens.colors.border}`, borderRadius: '6px' }}
                  />
                  <div style={{ fontSize: '11px', color: tokens.colors.textMuted, marginTop: '4px' }}>
                    🔒 Zero Plaintext Policy: Stores reference name `VERCEL_ERP_SAP_SECRET_KEY`, never raw passwords.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                  <button
                    onClick={handleTestErpSync}
                    disabled={syncingErp}
                    style={{ padding: '8px 16px', backgroundColor: tokens.colors.brand, color: '#FFFFFF', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    {syncingErp ? 'Testing Sync...' : '⚡ Test ERP Sync Stub'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Section 7: User & Role Governance */}
          {activeSection === 'rbac' && <SystemConfig role={role} />}
        </div>
      </div>
    </div>
  );
};
