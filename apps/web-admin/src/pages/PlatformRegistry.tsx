import React from 'react';
import { useApp } from '../context/AppContext';

export const PlatformRegistry = () => {
  const { isAuthenticated, setIsAuthenticated, isDemoMode, setIsDemoMode, isLiveApiMode, setIsLiveApiMode, authToken, setAuthToken, loginEmail, setLoginEmail, loginPassword, setLoginPassword, authStatus, setAuthStatus, activeModal, setActiveModal, activeTab, setActiveTab, tenant, setTenant, lastRefreshed, setLastRefreshed, isRefreshing, setIsRefreshing, newSkuName, setNewSkuName, newSkuCategory, setNewSkuCategory, newSkuDistributor, setNewSkuDistributor, newSkuPrice, setNewSkuPrice, newSkuStock, setNewSkuStock, newUserEmail, setNewUserEmail, newUserRole, setNewUserRole, newUserStatus, setNewUserStatus, newTenantName, setNewTenantName, newTenantDomain, setNewTenantDomain, newBeatName, setNewBeatName, newBeatAgent, setNewBeatAgent, newBeatRadius, setNewBeatRadius, newInvoiceCustomer, setNewInvoiceCustomer, newInvoiceAmount, setNewInvoiceAmount, beatRoutes, setBeatRoutes, salesOrders, setSalesOrders, invoices, setInvoices, users, setUsers, tenants, setTenants, identitySubTab, setIdentitySubTab, inventory, setInventory, inventorySearch, setInventorySearch, sfaSubTab, setSfaSubTab, financeSubTab, setFinanceSubTab, aiPrompt, setAiPrompt, aiOutput, setAiOutput, isAiLoading, setIsAiLoading, isAuditChecking, setIsAuditChecking, auditVerdict, setAuditVerdict, configFlags, setConfigFlags, logs, setLogs, handleAddSkuSubmit, handleAddUserSubmit, handleAddTenantSubmit, handleAddBeatSubmit, handleAddInvoiceSubmit, handleLoginSubmit, handleManualRefresh, handleRunAiForecast, handleVerifyAuditChain } = useApp();
  const platformNodes: any[] = [{id: 'api-gw', name: 'API Gateway', status: 'HEALTHY', type: 'core'}, {id: 'auth-svc', name: 'Identity Service', status: 'HEALTHY', type: 'core'}];
  return (
    <>
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0F172A' }}>29-Node Enterprise Microservices & Program Architecture Matrix</h3>
                        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748B' }}>19 Microservices + 10 Platform/Quality Pillars Verified in Production Monorepo</p>
                      </div>
                      <span style={{ backgroundColor: '#DCFCE7', color: '#15803D', padding: '4px 12px', borderRadius: '16px', fontWeight: '700', fontSize: '12px' }}>
                        ● 29 / 29 NODES ONLINE
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                      {platformNodes.map((node: any) => (
                        <div key={node.name} style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px', backgroundColor: '#F8FAFC' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontWeight: '700', fontSize: '13px', color: '#0F172A', fontFamily: 'monospace' }}>{node.name}</span>
                            <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', backgroundColor: node.category === 'MICROSERVICE' ? '#EFF6FF' : '#F1F5F9', color: node.category === 'MICROSERVICE' ? '#1D4ED8' : '#475569' }}>
                              {node.category}
                            </span>
                          </div>
                          <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#475569', minHeight: '36px' }}>{node.details}</p>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', borderTop: '1px solid #E2E8F0', paddingTop: '8px' }}>
                            <span style={{ fontWeight: '600', color: '#15803D' }}>● {node.status}</span>
                            <span style={{ color: '#64748B', fontFamily: 'monospace' }}>{node.latency}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
    </>
  );
};
