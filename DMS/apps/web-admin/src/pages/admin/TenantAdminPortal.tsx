import React, { useState } from 'react';

export interface DistributorPartner {
  id: string;
  name: string;
  code: string;
  region: string;
  status: 'ACTIVE' | 'ONBOARDING' | 'SUSPENDED';
  contactPerson: string;
  email: string;
  phone: string;
}

export interface UserInvite {
  id: string;
  email: string;
  role: 'admin' | 'distributor' | 'agent' | 'auditor';
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED';
  invitedAt: string;
}

export interface ErpConnection {
  type: 'SAP' | 'ORACLE' | 'DYNAMICS' | 'CUSTOM' | 'NONE';
  endpoint: string;
  apiKey: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'TESTING';
  lastSyncedAt?: string;
}

export interface TenantBranding {
  companyName: string;
  subdomain: string;
  customDomain: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  portalTitle: string;
}

export const TenantAdminPortal: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'distributors' | 'users' | 'erp' | 'modules' | 'branding'>('distributors');

  // State: Distributors
  const [distributors, setDistributors] = useState<DistributorPartner[]>([
    { id: 'dst-101', name: 'Apex Logistics & Wholesale', code: 'DIST-APEX', region: 'North Zone', status: 'ACTIVE', contactPerson: 'Rajesh Kumar', email: 'rajesh@apexlogistics.com', phone: '+91 98765 43210' },
    { id: 'dst-102', name: 'Metro Supply Chain Ltd', code: 'DIST-METRO', region: 'West Zone', status: 'ACTIVE', contactPerson: 'Sunita Sharma', email: 'sunita@metrosupply.in', phone: '+91 98123 45678' },
    { id: 'dst-103', name: 'Pacific Trade Links', code: 'DIST-PACIFIC', region: 'South Zone', status: 'ONBOARDING', contactPerson: 'Vikram Reddy', email: 'v.reddy@pacifictrade.com', phone: '+91 94400 12345' },
  ]);
  const [showAddDistributorModal, setShowAddDistributorModal] = useState(false);
  const [newDistributor, setNewDistributor] = useState({ name: '', code: '', region: 'Central Zone', contactPerson: '', email: '', phone: '' });

  // State: User Invites
  const [invites, setInvites] = useState<UserInvite[]>([
    { id: 'inv-1', email: 'sales.lead@enterprise-dms.com', role: 'agent', status: 'ACCEPTED', invitedAt: '2026-08-01' },
    { id: 'inv-2', email: 'finance.mgr@enterprise-dms.com', role: 'auditor', status: 'PENDING', invitedAt: '2026-08-04' },
    { id: 'inv-3', email: 'partner.west@metrosupply.in', role: 'distributor', status: 'PENDING', invitedAt: '2026-08-05' },
  ]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'distributor' | 'agent' | 'auditor'>('agent');

  // State: ERP
  const [erpConfig, setErpConfig] = useState<ErpConnection>({
    type: 'SAP',
    endpoint: 'https://sap-gateway.internal.net/sap/bc/sdata/rfc',
    apiKey: '••••••••••••••••••••••••••••',
    status: 'CONNECTED',
    lastSyncedAt: '2026-08-05 18:30 UTC',
  });
  const [isTestingErp, setIsTestingErp] = useState(false);
  const [erpMessage, setErpMessage] = useState<string | null>(null);

  // State: Channel Modules
  const [activeModules, setActiveModules] = useState<Record<string, boolean>>({
    DMS_CORE: true,
    SFA_FORCE: true,
    VAN_SALES: true,
    TRADE_SCHEMES: true,
    AI_FORECAST: false,
    CLAIMS_MANAGEMENT: true,
  });

  // State: Branding
  const [branding, setBranding] = useState<TenantBranding>({
    companyName: 'Acme Distribution Enterprise',
    subdomain: 'acme-distrib',
    customDomain: 'dms.acmeenterprise.com',
    logoUrl: 'https://img.freepik.com/free-vector/abstract-company-logo_53876-120501.jpg',
    primaryColor: '#0F172A',
    secondaryColor: '#2563EB',
    portalTitle: 'Acme Unified DMS & SFA Control Center',
  });
  const [brandingSaved, setBrandingSaved] = useState(false);

  // Actions
  const handleAddDistributor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDistributor.name || !newDistributor.code) return;
    const added: DistributorPartner = {
      id: `dst-${Date.now().toString().slice(-4)}`,
      name: newDistributor.name,
      code: newDistributor.code.toUpperCase(),
      region: newDistributor.region,
      status: 'ONBOARDING',
      contactPerson: newDistributor.contactPerson || 'N/A',
      email: newDistributor.email || 'pending@partner.com',
      phone: newDistributor.phone || 'N/A',
    };
    setDistributors([...distributors, added]);
    setShowAddDistributorModal(false);
    setNewDistributor({ name: '', code: '', region: 'Central Zone', contactPerson: '', email: '', phone: '' });
  };

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    const newInv: UserInvite = {
      id: `inv-${Date.now().toString().slice(-4)}`,
      email: inviteEmail.trim().toLowerCase(),
      role: inviteRole,
      status: 'PENDING',
      invitedAt: new Date().toISOString().split('T')[0],
    };
    setInvites([newInv, ...invites]);
    setInviteEmail('');
  };

  const handleTestErpConnection = () => {
    setIsTestingErp(true);
    setErpMessage(null);
    setTimeout(() => {
      setIsTestingErp(false);
      setErpConfig({ ...erpConfig, status: 'CONNECTED', lastSyncedAt: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC' });
      setErpMessage('✓ ERP Handshake successful! Latency: 42ms. 1,420 SKU records synchronized.');
    }, 1200);
  };

  const handleSaveBranding = (e: React.FormEvent) => {
    e.preventDefault();
    setBrandingSaved(true);
    setTimeout(() => setBrandingSaved(false), 3000);
  };

  const toggleModule = (modKey: string) => {
    if (modKey === 'DMS_CORE') return; // Always required
    setActiveModules({ ...activeModules, [modKey]: !activeModules[modKey] });
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', color: '#1E293B', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
        borderRadius: '16px',
        padding: '24px 32px',
        color: '#FFFFFF',
        marginBottom: '24px',
        boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.25)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <span style={{ background: '#3B82F6', color: '#FFF', fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Tenant Self-Service Portal
            </span>
            <span style={{ background: 'rgba(255, 255, 255, 0.15)', color: '#93C5FD', fontSize: '12px', padding: '3px 10px', borderRadius: '12px' }}>
              Plan: PROFESSIONAL (SHARED_RLS)
            </span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>{branding.companyName}</h1>
          <p style={{ margin: '4px 0 0', color: '#94A3B8', fontSize: '14px' }}>
            Subdomain: <code style={{ color: '#60A5FA' }}>{branding.subdomain}.dms.com</code> | Region: <strong style={{ color: '#E2E8F0' }}>Singapore (ap-south-1)</strong>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => setShowAddDistributorModal(true)}
            style={{
              background: '#2563EB',
              color: '#FFF',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 18px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
              transition: 'transform 0.1s ease'
            }}
          >
            + Onboard Distributor
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #E2E8F0', marginBottom: '24px' }}>
        {[
          { key: 'distributors', label: 'Distributor Partners', badge: distributors.length },
          { key: 'users', label: 'User Invites & RBAC', badge: invites.length },
          { key: 'erp', label: 'ERP Integration', badge: erpConfig.status === 'CONNECTED' ? 'Active' : 'Offline' },
          { key: 'modules', label: 'Channel Modules', badge: `${Object.values(activeModules).filter(Boolean).length} Active` },
          { key: 'branding', label: 'Branding & Domain', badge: branding.customDomain ? 'Custom' : 'Standard' },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: isActive ? '3px solid #2563EB' : '3px solid transparent',
                padding: '12px 18px',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#2563EB' : '#64748B',
                cursor: 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '-2px'
              }}
            >
              {tab.label}
              <span style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '10px',
                background: isActive ? '#DBEAFE' : '#F1F5F9',
                color: isActive ? '#1E40AF' : '#64748B',
                fontWeight: 600
              }}>
                {tab.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: DISTRIBUTORS */}
      {activeTab === 'distributors' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Associated Wholesale Distributors</h3>
            <span style={{ fontSize: '13px', color: '#64748B' }}>Total <strong>{distributors.length}</strong> partners registered</span>
          </div>

          <div style={{ background: '#FFF', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
                  <th style={{ padding: '14px 18px' }}>Distributor Name</th>
                  <th style={{ padding: '14px 18px' }}>Partner Code</th>
                  <th style={{ padding: '14px 18px' }}>Region / Territory</th>
                  <th style={{ padding: '14px 18px' }}>Contact Person</th>
                  <th style={{ padding: '14px 18px' }}>Contact Email</th>
                  <th style={{ padding: '14px 18px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {distributors.map((d) => (
                  <tr key={d.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '14px 18px', fontWeight: 600, color: '#0F172A' }}>{d.name}</td>
                    <td style={{ padding: '14px 18px' }}><code style={{ background: '#F1F5F9', padding: '3px 6px', borderRadius: '4px', fontSize: '12px' }}>{d.code}</code></td>
                    <td style={{ padding: '14px 18px', color: '#475569' }}>{d.region}</td>
                    <td style={{ padding: '14px 18px', color: '#334155' }}>{d.contactPerson}</td>
                    <td style={{ padding: '14px 18px', color: '#64748B' }}>{d.email}</td>
                    <td style={{ padding: '14px 18px' }}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: d.status === 'ACTIVE' ? '#DCFCE7' : '#FEF9C3',
                        color: d.status === 'ACTIVE' ? '#166534' : '#854D0E',
                      }}>
                        {d.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: USER INVITES */}
      {activeTab === 'users' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 16px' }}>User Invitation Registry</h3>
            <div style={{ background: '#FFF', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
                    <th style={{ padding: '14px 18px' }}>Email Address</th>
                    <th style={{ padding: '14px 18px' }}>Assigned Role</th>
                    <th style={{ padding: '14px 18px' }}>Invited Date</th>
                    <th style={{ padding: '14px 18px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map((inv) => (
                    <tr key={inv.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '14px 18px', fontWeight: 600 }}>{inv.email}</td>
                      <td style={{ padding: '14px 18px' }}>
                        <span style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
                          {inv.role}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px', color: '#64748B' }}>{inv.invitedAt}</td>
                      <td style={{ padding: '14px 18px' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background: inv.status === 'ACCEPTED' ? '#DCFCE7' : '#FEF3C7',
                          color: inv.status === 'ACCEPTED' ? '#15803D' : '#B45309',
                        }}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ background: '#FFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px', height: 'fit-content' }}>
            <h4 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 14px' }}>Invite Team Member</h4>
            <form onSubmit={handleSendInvite}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '14px' }}
                />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Assigned RBAC Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '14px' }}
                >
                  <option value="agent">Field Agent (SFA Rep)</option>
                  <option value="distributor">Distributor Admin</option>
                  <option value="auditor">Auditor / View-Only</option>
                  <option value="admin">Tenant Administrator</option>
                </select>
              </div>

              <button
                type="submit"
                style={{ width: '100%', background: '#2563EB', color: '#FFF', border: 'none', borderRadius: '6px', padding: '10px', fontWeight: 600, cursor: 'pointer' }}
              >
                Send Invitation Token
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 3: ERP INTEGRATION */}
      {activeTab === 'erp' && (
        <div style={{ background: '#FFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px', maxWidth: '800px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px' }}>Enterprise Resource Planning (ERP) Connector</h3>
          <p style={{ color: '#64748B', fontSize: '14px', marginBottom: '20px' }}>
            Synchronize SKUs, master price lists, inventory updates, and order confirmations with upstream ERP systems.
          </p>

          {erpMessage && (
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#166534', padding: '12px 16px', borderRadius: '8px', marginBottom: '18px', fontSize: '14px' }}>
              {erpMessage}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>ERP System Type</label>
              <select
                value={erpConfig.type}
                onChange={(e) => setErpConfig({ ...erpConfig, type: e.target.value as any })}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '14px' }}
              >
                <option value="SAP">SAP S/4HANA (RFC / BAPI)</option>
                <option value="TALLY_PRIME">Tally Prime / Tally.ERP 9 (XML HTTP)</option>
                <option value="GENERIC_REST">Generic REST API Adapter</option>
                <option value="CSV_SFTP">CSV / SFTP File Ingestion Adapter</option>
                <option value="ORACLE">Oracle Fusion ERP</option>
                <option value="DYNAMICS">Microsoft Dynamics 365</option>
                <option value="NONE">No ERP Integration (Standalone)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Connection Status</label>
              <div style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0', fontWeight: 600, color: erpConfig.status === 'CONNECTED' ? '#166534' : '#DC2626', fontSize: '14px' }}>
                ● {erpConfig.status} {erpConfig.lastSyncedAt && `(Last sync: ${erpConfig.lastSyncedAt})`}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>ERP Gateway Endpoint URL / SFTP Host</label>
            <input
              type="text"
              value={erpConfig.endpoint}
              onChange={(e) => setErpConfig({ ...erpConfig, endpoint: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '14px', fontFamily: 'monospace' }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>API Authentication Vault Secret Key</label>
            <input
              type="password"
              value={erpConfig.apiKey}
              onChange={(e) => setErpConfig({ ...erpConfig, apiKey: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '14px' }}
            />
          </div>

          {/* FIELD MAPPING SECTION */}
          <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid #E2E8F0' }}>
            <h4 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 10px', color: '#0F172A' }}>ERP to Canonical DMS Field-Mapping Engine</h4>
            <p style={{ color: '#64748B', fontSize: '13px', marginBottom: '16px' }}>
              Configure custom field mappings between your ERP payload schema and canonical DMS entities without code changes.
            </p>

            <div style={{ background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', fontWeight: 600, fontSize: '12px', color: '#475569', marginBottom: '8px' }}>
                <div>Canonical Field</div>
                <div>ERP Payload Field</div>
                <div>Transformation Rule</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '8px' }}>
                <input readOnly value="Product SKU / Code" style={{ padding: '8px', borderRadius: '4px', border: '1px solid #CBD5E1', background: '#F1F5F9', fontSize: '13px' }} />
                <input defaultValue="GUID / ITEM_CODE" style={{ padding: '8px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '13px' }} />
                <input readOnly value="Trim Whitespace" style={{ padding: '8px', borderRadius: '4px', border: '1px solid #CBD5E1', background: '#F1F5F9', fontSize: '13px' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '8px' }}>
                <input readOnly value="Product Name" style={{ padding: '8px', borderRadius: '4px', border: '1px solid #CBD5E1', background: '#F1F5F9', fontSize: '13px' }} />
                <input defaultValue="NAME / ITEM_DESC" style={{ padding: '8px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '13px' }} />
                <input readOnly value="None" style={{ padding: '8px', borderRadius: '4px', border: '1px solid #CBD5E1', background: '#F1F5F9', fontSize: '13px' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <input readOnly value="Unit Price (Cents)" style={{ padding: '8px', borderRadius: '4px', border: '1px solid #CBD5E1', background: '#F1F5F9', fontSize: '13px' }} />
                <input defaultValue="RATE / PRICE_AMOUNT" style={{ padding: '8px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '13px' }} />
                <input readOnly value="Parse Cents (x100)" style={{ padding: '8px', borderRadius: '4px', border: '1px solid #CBD5E1', background: '#F1F5F9', fontSize: '13px' }} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleTestErpConnection}
              disabled={isTestingErp}
              style={{ background: '#0F172A', color: '#FFF', border: 'none', borderRadius: '6px', padding: '10px 20px', fontWeight: 600, cursor: 'pointer' }}
            >
              {isTestingErp ? 'Testing ERP Connector & Vault Secret...' : 'Test ERP Connector Handshake'}
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: CHANNEL MODULES */}
      {activeTab === 'modules' && (
        <div style={{ background: '#FFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px', maxWidth: '900px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px' }}>Active Channel Modules</h3>
          <p style={{ color: '#64748B', fontSize: '14px', marginBottom: '20px' }}>
            Enable or disable specialized SFA & Distribution execution modules for your field reps and distributors.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {[
              { key: 'DMS_CORE', name: 'DMS Core Catalog & Inventory', desc: 'Central SKU management, price lists, and stock ledger' },
              { key: 'SFA_FORCE', name: 'SFA Field Force Automation', desc: 'Beat route planning, outlet visits, order capture, and GPS tracking' },
              { key: 'VAN_SALES', name: 'Van Sales & Direct Delivery', desc: 'Mobile invoicing, stock loading, and spot delivery receipt printing' },
              { key: 'TRADE_SCHEMES', name: 'Trade Schemes & Promotions', desc: 'Volume discounts, slab-based schemes, and secondary claims processing' },
              { key: 'AI_FORECAST', name: 'AI Demand Forecasting', desc: 'Predictive stock replenishment and ML-based sales territory insights' },
              { key: 'CLAIMS_MANAGEMENT', name: 'Secondary Claims Settlement', desc: 'Distributor credit notes and claims verification engine' },
            ].map((mod) => {
              const enabled = activeModules[mod.key];
              return (
                <div
                  key={mod.key}
                  style={{
                    padding: '16px',
                    borderRadius: '10px',
                    border: enabled ? '2px solid #2563EB' : '1px solid #E2E8F0',
                    background: enabled ? '#F8FAFC' : '#FFF',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '12px'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: '#0F172A', marginBottom: '4px' }}>{mod.name}</div>
                    <div style={{ fontSize: '12px', color: '#64748B', lineHeight: '1.4' }}>{mod.desc}</div>
                  </div>
                  <button
                    onClick={() => toggleModule(mod.key)}
                    disabled={mod.key === 'DMS_CORE'}
                    style={{
                      background: enabled ? '#2563EB' : '#CBD5E1',
                      color: '#FFF',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '4px 12px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: mod.key === 'DMS_CORE' ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {enabled ? 'Active' : 'Disabled'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 5: BRANDING & DOMAIN */}
      {activeTab === 'branding' && (
        <div style={{ background: '#FFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px', maxWidth: '800px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px' }}>Portal Custom Branding & Custom Domain</h3>
          <p style={{ color: '#64748B', fontSize: '14px', marginBottom: '20px' }}>
            Customize the look and feel of your organization's DMS Web Admin and mobile app screens.
          </p>

          {brandingSaved && (
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#166534', padding: '12px 16px', borderRadius: '8px', marginBottom: '18px', fontSize: '14px' }}>
              ✓ Tenant branding and custom domain settings updated successfully.
            </div>
          )}

          <form onSubmit={handleSaveBranding}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Company Display Name</label>
              <input
                type="text"
                value={branding.companyName}
                onChange={(e) => setBranding({ ...branding, companyName: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '14px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Subdomain Handle</label>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={branding.subdomain}
                    onChange={(e) => setBranding({ ...branding, subdomain: e.target.value })}
                    style={{ flex: 1, padding: '10px 12px', borderRadius: '6px 0 0 6px', border: '1px solid #CBD5E1', fontSize: '14px' }}
                  />
                  <span style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', borderLeft: 'none', padding: '10px 12px', borderRadius: '0 6px 6px 0', fontSize: '14px', color: '#64748B' }}>.dms.com</span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Custom Domain Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. dms.acmeenterprise.com"
                  value={branding.customDomain}
                  onChange={(e) => setBranding({ ...branding, customDomain: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '14px' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Company Logo Image URL</label>
              <input
                type="text"
                value={branding.logoUrl}
                onChange={(e) => setBranding({ ...branding, logoUrl: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '14px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Primary Theme Color</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="color"
                    value={branding.primaryColor}
                    onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                    style={{ width: '42px', height: '42px', border: 'none', cursor: 'pointer', borderRadius: '6px' }}
                  />
                  <input
                    type="text"
                    value={branding.primaryColor}
                    onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                    style={{ flex: 1, padding: '10px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '14px', fontFamily: 'monospace' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Accent Highlight Color</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="color"
                    value={branding.secondaryColor}
                    onChange={(e) => setBranding({ ...branding, secondaryColor: e.target.value })}
                    style={{ width: '42px', height: '42px', border: 'none', cursor: 'pointer', borderRadius: '6px' }}
                  />
                  <input
                    type="text"
                    value={branding.secondaryColor}
                    onChange={(e) => setBranding({ ...branding, secondaryColor: e.target.value })}
                    style={{ flex: 1, padding: '10px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '14px', fontFamily: 'monospace' }}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              style={{ background: '#2563EB', color: '#FFF', border: 'none', borderRadius: '6px', padding: '10px 24px', fontWeight: 600, cursor: 'pointer' }}
            >
              Save Branding & Domain Settings
            </button>
          </form>
        </div>
      )}

      {/* MODAL: ADD DISTRIBUTOR */}
      {showAddDistributorModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ background: '#FFF', borderRadius: '12px', width: '480px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 16px' }}>Onboard Wholesale Distributor</h3>
            <form onSubmit={handleAddDistributor}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Distributor Name *</label>
                <input required type="text" placeholder="e.g. Acme Southern Distributors" value={newDistributor.name} onChange={(e) => setNewDistributor({ ...newDistributor, name: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1' }} />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Partner Code *</label>
                <input required type="text" placeholder="e.g. DIST-SOUTH-01" value={newDistributor.code} onChange={(e) => setNewDistributor({ ...newDistributor, code: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1' }} />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Contact Email</label>
                <input type="email" placeholder="admin@partner.com" value={newDistributor.email} onChange={(e) => setNewDistributor({ ...newDistributor, email: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1' }} />
              </div>
              <div style={{ display: 'flex', justifySelf: 'end', gap: '12px', marginTop: '20px' }}>
                <button type="button" onClick={() => setShowAddDistributorModal(false)} style={{ background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ background: '#2563EB', color: '#FFF', border: 'none', borderRadius: '6px', padding: '8px 16px', fontWeight: 600, cursor: 'pointer' }}>Save Partner</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
