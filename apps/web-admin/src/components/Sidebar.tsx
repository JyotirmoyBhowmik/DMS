import React from 'react';
import { useApp } from '../context/AppContext';

export const Sidebar = () => {
  const { isAuthenticated, setIsAuthenticated, isDemoMode, setIsDemoMode, isLiveApiMode, setIsLiveApiMode, authToken, setAuthToken, loginEmail, setLoginEmail, loginPassword, setLoginPassword, authStatus, setAuthStatus, activeModal, setActiveModal, activeTab, setActiveTab, tenant, setTenant, lastRefreshed, setLastRefreshed, isRefreshing, setIsRefreshing, newSkuName, setNewSkuName, newSkuCategory, setNewSkuCategory, newSkuDistributor, setNewSkuDistributor, newSkuPrice, setNewSkuPrice, newSkuStock, setNewSkuStock, newUserEmail, setNewUserEmail, newUserRole, setNewUserRole, newUserStatus, setNewUserStatus, newTenantName, setNewTenantName, newTenantDomain, setNewTenantDomain, newBeatName, setNewBeatName, newBeatAgent, setNewBeatAgent, newBeatRadius, setNewBeatRadius, newInvoiceCustomer, setNewInvoiceCustomer, newInvoiceAmount, setNewInvoiceAmount, beatRoutes, setBeatRoutes, salesOrders, setSalesOrders, invoices, setInvoices, users, setUsers, tenants, setTenants, identitySubTab, setIdentitySubTab, inventory, setInventory, inventorySearch, setInventorySearch, sfaSubTab, setSfaSubTab, financeSubTab, setFinanceSubTab, aiPrompt, setAiPrompt, aiOutput, setAiOutput, isAiLoading, setIsAiLoading, isAuditChecking, setIsAuditChecking, auditVerdict, setAuditVerdict, configFlags, setConfigFlags, logs, setLogs, handleAddSkuSubmit, handleAddUserSubmit, handleAddTenantSubmit, handleAddBeatSubmit, handleAddInvoiceSubmit, handleLoginSubmit, handleManualRefresh, handleRunAiForecast, handleVerifyAuditChain } = useApp();
  return (
    <aside style={{ width: '260px', backgroundColor: '#FFFFFF', borderRight: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <div style={{ padding: '24px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#0F172A', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px' }}>
                D
              </div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '15px', color: '#0F172A' }}>DMS & SFA PLATFORM</div>
                <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '500' }}>19 Microservices + 10 Pillars</div>
              </div>
            </div>

            {/* Tenant Context Selector */}
            <div style={{ padding: '16px 20px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748B', textTransform: 'uppercase', marginBottom: '6px' }}>Tenant Context</div>
              <select
                value={tenant}
                onChange={(e) => setTenant(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', fontSize: '13px', fontWeight: '600', color: '#0F172A', outline: 'none' }}
              >
                {tenants.map((t: any) => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Navigation Item Tabs */}
            <nav style={{ padding: '16px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {[
                { id: 'overview', label: 'Overview Control Hub', icon: '📊', desc: 'Global Metrics & Traffic' },
                { id: 'platform-registry', label: '19 Services & 10 Pillars Matrix', icon: '🏛️', desc: '29 Nodes Health Matrix' },
                { id: 'identity', label: 'Identity & Access (RBAC)', icon: '🔒', desc: 'Users, Roles & MFA' },
                { id: 'dms-core', label: 'DMS Core Management', icon: '📦', desc: 'SKUs, Stock & Outlets' },
                { id: 'sfa', label: 'SFA Field Operations', icon: '🚚', desc: 'Beats, Routes & Approvals' },
                { id: 'pricing-schemes', label: 'Pricing & Schemes', icon: '🏷️', desc: 'Rules & Promotions' },
                { id: 'claims-finance', label: 'Claims & Invoicing', icon: '💰', desc: 'Invoices, Claims & Credits' },
                { id: 'ai-forecasting', label: 'AI & Demand Hub', icon: '⚡', desc: 'Predictive Reordering' },
                { id: 'audit-logs', label: 'Cryptographic Audit', icon: '🛡️', desc: 'Immutable Blockchain' },
                { id: 'integration-sync', label: 'Gateway & Sync Queue', icon: '🔄', desc: 'Upstream Network Sync' },
                { id: 'config-file-notify', label: 'Config & System Alerts', icon: '⚙️', desc: 'Flags, Assets & Reports' }
              ].map((item: any) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as string)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: isActive ? '#0F172A' : 'transparent',
                      color: isActive ? '#FFFFFF' : '#334155',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span style={{ fontSize: '18px' }}>{item.icon}</span>
                    <div>
                      <div style={{ fontWeight: isActive ? '600' : '500', fontSize: '13px' }}>{item.label}</div>
                      <div style={{ fontSize: '10px', color: isActive ? '#94A3B8' : '#64748B' }}>{item.desc}</div>
                    </div>
                  </button>
                );
              })}
            </nav>

            {/* Sidebar Footer */}
            <div style={{ padding: '16px 20px', borderTop: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#64748B' }}>
                <span>Build Integrity</span>
                <span style={{ fontWeight: '600', color: '#166534', backgroundColor: '#DCFCE7', padding: '2px 8px', borderRadius: '12px' }}>STABLE</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#64748B', marginTop: '6px' }}>
                <span>Monorepo Nodes</span>
                <span style={{ fontWeight: '600', color: '#0F172A' }}>29 / 29 Verified</span>
              </div>
            </div>
          </aside>
  );
};
