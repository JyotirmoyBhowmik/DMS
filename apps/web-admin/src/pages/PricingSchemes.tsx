import React from 'react';
import { useApp } from '../context/AppContext';

export const PricingSchemes = () => {
  const { isAuthenticated, setIsAuthenticated, isDemoMode, setIsDemoMode, isLiveApiMode, setIsLiveApiMode, authToken, setAuthToken, loginEmail, setLoginEmail, loginPassword, setLoginPassword, authStatus, setAuthStatus, activeModal, setActiveModal, activeTab, setActiveTab, tenant, setTenant, lastRefreshed, setLastRefreshed, isRefreshing, setIsRefreshing, newSkuName, setNewSkuName, newSkuCategory, setNewSkuCategory, newSkuDistributor, setNewSkuDistributor, newSkuPrice, setNewSkuPrice, newSkuStock, setNewSkuStock, newUserEmail, setNewUserEmail, newUserRole, setNewUserRole, newUserStatus, setNewUserStatus, newTenantName, setNewTenantName, newTenantDomain, setNewTenantDomain, newBeatName, setNewBeatName, newBeatAgent, setNewBeatAgent, newBeatRadius, setNewBeatRadius, newInvoiceCustomer, setNewInvoiceCustomer, newInvoiceAmount, setNewInvoiceAmount, beatRoutes, setBeatRoutes, salesOrders, setSalesOrders, invoices, setInvoices, users, setUsers, tenants, setTenants, identitySubTab, setIdentitySubTab, inventory, setInventory, inventorySearch, setInventorySearch, sfaSubTab, setSfaSubTab, financeSubTab, setFinanceSubTab, aiPrompt, setAiPrompt, aiOutput, setAiOutput, isAiLoading, setIsAiLoading, isAuditChecking, setIsAuditChecking, auditVerdict, setAuditVerdict, configFlags, setConfigFlags, logs, setLogs, handleAddSkuSubmit, handleAddUserSubmit, handleAddTenantSubmit, handleAddBeatSubmit, handleAddInvoiceSubmit, handleLoginSubmit, handleManualRefresh, handleRunAiForecast, handleVerifyAuditChain } = useApp();
  const tradeSchemes: any[] = [{id: 'sch-1', name: 'Q3 Summer Bonus', rules: 'Buy 100 get 5 free'}];
  return (
    <>
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '700' }}>Trade Promotion Schemes & Channel Price Rules</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                          <th style={{ padding: '12px' }}>Scheme Name</th>
                          <th style={{ padding: '12px' }}>Type</th>
                          <th style={{ padding: '12px' }}>Min Qty Required</th>
                          <th style={{ padding: '12px' }}>Promotional Reward</th>
                          <th style={{ padding: '12px' }}>Validity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tradeSchemes.map((s: any) => (
                          <tr key={s.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '12px', fontWeight: '700', color: '#0F172A' }}>{s.name}</td>
                            <td style={{ padding: '12px', color: '#2563EB', fontWeight: '600' }}>{s.type}</td>
                            <td style={{ padding: '12px' }}>{s.minQty} Units</td>
                            <td style={{ padding: '12px', color: '#15803D', fontWeight: '700' }}>{s.reward}</td>
                            <td style={{ padding: '12px', color: '#64748B' }}>{s.validUntil}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
    </>
  );
};
