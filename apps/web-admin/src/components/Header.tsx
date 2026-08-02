import React from 'react';
import { useApp } from '../context/AppContext';

export const Header = () => {
  const { isAuthenticated, setIsAuthenticated, isDemoMode, setIsDemoMode, isLiveApiMode, setIsLiveApiMode, authToken, setAuthToken, loginEmail, setLoginEmail, loginPassword, setLoginPassword, authStatus, setAuthStatus, activeModal, setActiveModal, activeTab, setActiveTab, tenant, setTenant, lastRefreshed, setLastRefreshed, isRefreshing, setIsRefreshing, newSkuName, setNewSkuName, newSkuCategory, setNewSkuCategory, newSkuDistributor, setNewSkuDistributor, newSkuPrice, setNewSkuPrice, newSkuStock, setNewSkuStock, newUserEmail, setNewUserEmail, newUserRole, setNewUserRole, newUserStatus, setNewUserStatus, newTenantName, setNewTenantName, newTenantDomain, setNewTenantDomain, newBeatName, setNewBeatName, newBeatAgent, setNewBeatAgent, newBeatRadius, setNewBeatRadius, newInvoiceCustomer, setNewInvoiceCustomer, newInvoiceAmount, setNewInvoiceAmount, beatRoutes, setBeatRoutes, salesOrders, setSalesOrders, invoices, setInvoices, users, setUsers, tenants, setTenants, identitySubTab, setIdentitySubTab, inventory, setInventory, inventorySearch, setInventorySearch, sfaSubTab, setSfaSubTab, financeSubTab, setFinanceSubTab, aiPrompt, setAiPrompt, aiOutput, setAiOutput, isAiLoading, setIsAiLoading, isAuditChecking, setIsAuditChecking, auditVerdict, setAuditVerdict, configFlags, setConfigFlags, logs, setLogs, handleAddSkuSubmit, handleAddUserSubmit, handleAddTenantSubmit, handleAddBeatSubmit, handleAddInvoiceSubmit, handleLoginSubmit, handleManualRefresh, handleRunAiForecast, handleVerifyAuditChain } = useApp();
  return (
    <header style={{ height: '64px', backgroundColor: '#FFFFFF', borderBottom: '1px solid #E2E8F0', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0F172A' }}>
                  {activeTab === 'overview' && 'Overview Control Hub'}
                  {activeTab === 'platform-registry' && '29-Node Enterprise Architecture & Platform Matrix'}
                  {activeTab === 'identity' && 'Identity & Security Management (identity-service)'}
                  {activeTab === 'dms-core' && 'DMS Core Management (dms-core-service)'}
                  {activeTab === 'sfa' && 'SFA Field Operations, Beat Routes & Approvals (sfa-service)'}
                  {activeTab === 'pricing-schemes' && 'Pricing Rules & Trade Schemes (pricing & schemes)'}
                  {activeTab === 'claims-finance' && 'Invoicing, Trade Claims & Financial Ledger (claims & finance)'}
                  {activeTab === 'ai-forecasting' && 'AI & Forecasting Engine (ai & recommendation)'}
                  {activeTab === 'audit-logs' && 'Cryptographic Blockchain Audit Ledger (audit-service)'}
                  {activeTab === 'integration-sync' && 'Upstream Gateway & Offline Sync (api-gateway & sync)'}
                  {activeTab === 'config-file-notify' && 'System Configuration & Alerts (config & notification)'}
                </h1>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>
                  Enterprise Monorepo Unit • Active Context: <strong style={{ color: '#0F172A' }}>{tenant}</strong>
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  onClick={() => setActiveModal('add-sku')}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#2563EB',
                    color: '#FFFFFF',
                    fontWeight: '700',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  + Input Data / Form
                </button>

                {/* Mode Switcher */}
                <button
                  onClick={() => setIsLiveApiMode(!isLiveApiMode)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '20px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: isLiveApiMode ? '#DCFCE7' : '#F1F5F9',
                    color: isLiveApiMode ? '#15803D' : '#475569',
                    fontWeight: '700',
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                >
                  {isLiveApiMode ? '● LIVE API MODE (api.dms.jyotirmoyb.com)' : '○ STATIC DEMO MODE'}
                </button>

                <button
                  onClick={() => {
                    setIsAuthenticated(false);
                    setIsDemoMode(false);
                  }}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#0F172A',
                    fontWeight: '600',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  🚪 Sign Out
                </button>

                <div style={{ fontSize: '12px', color: '#64748B', textAlign: 'right' }}>
                  <div>Last Synced: <strong>{lastRefreshed}</strong></div>
                </div>
                <button
                  onClick={handleManualRefresh}
                  disabled={isRefreshing}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#0F172A',
                    fontWeight: '600',
                    fontSize: '13px',
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}
                >
                  {isRefreshing ? 'Refreshing...' : '↻ Sweep Telemetry'}
                </button>
              </div>
            </header>
  );
};
