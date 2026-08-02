import React from 'react';
import { useApp } from '../context/AppContext';

export const ClaimsFinance = () => {
  const { isAuthenticated, setIsAuthenticated, isDemoMode, setIsDemoMode, isLiveApiMode, setIsLiveApiMode, authToken, setAuthToken, loginEmail, setLoginEmail, loginPassword, setLoginPassword, authStatus, setAuthStatus, activeModal, setActiveModal, activeTab, setActiveTab, tenant, setTenant, lastRefreshed, setLastRefreshed, isRefreshing, setIsRefreshing, newSkuName, setNewSkuName, newSkuCategory, setNewSkuCategory, newSkuDistributor, setNewSkuDistributor, newSkuPrice, setNewSkuPrice, newSkuStock, setNewSkuStock, newUserEmail, setNewUserEmail, newUserRole, setNewUserRole, newUserStatus, setNewUserStatus, newTenantName, setNewTenantName, newTenantDomain, setNewTenantDomain, newBeatName, setNewBeatName, newBeatAgent, setNewBeatAgent, newBeatRadius, setNewBeatRadius, newInvoiceCustomer, setNewInvoiceCustomer, newInvoiceAmount, setNewInvoiceAmount, beatRoutes, setBeatRoutes, salesOrders, setSalesOrders, invoices, setInvoices, users, setUsers, tenants, setTenants, identitySubTab, setIdentitySubTab, inventory, setInventory, inventorySearch, setInventorySearch, sfaSubTab, setSfaSubTab, financeSubTab, setFinanceSubTab, aiPrompt, setAiPrompt, aiOutput, setAiOutput, isAiLoading, setIsAiLoading, isAuditChecking, setIsAuditChecking, auditVerdict, setAuditVerdict, configFlags, setConfigFlags, logs, setLogs, handleAddSkuSubmit, handleAddUserSubmit, handleAddTenantSubmit, handleAddBeatSubmit, handleAddInvoiceSubmit, handleLoginSubmit, handleManualRefresh, handleRunAiForecast, handleVerifyAuditChain } = useApp();
  const claims: any[] = [{id: 'clm-1', distributor: 'Metro Wholesalers', type: 'Damage', amount: '$450', status: 'PENDING'}];
  return (
    <>
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px', marginBottom: '20px' }}>
                      {[
                        { id: 'claims', label: `Trade Claims (${claims.length})` },
                        { id: 'invoices', label: `Invoices & Credit Notes (${invoices.length})` }
                      ].map((sub: any) => (
                        <button
                          key={sub.id}
                          onClick={() => setFinanceSubTab(sub.id as any)}
                          style={{
                            padding: '8px 16px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: financeSubTab === sub.id ? '#0F172A' : '#F1F5F9',
                            color: financeSubTab === sub.id ? '#FFFFFF' : '#475569',
                            fontWeight: '600',
                            fontSize: '13px',
                            cursor: 'pointer'
                          }}
                        >
                          {sub.label}
                        </button>
                      ))}
                    </div>

                    {financeSubTab === 'invoices' && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>Sales Invoices & Credit Notes Ledger</h3>
                          <button
                            onClick={() => setActiveModal('add-invoice')}
                            style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: '#2563EB', color: '#FFFFFF', border: 'none', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}
                          >
                            + Generate Invoice
                          </button>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                              <th style={{ padding: '12px' }}>Invoice #</th>
                              <th style={{ padding: '12px' }}>Distributor / Customer</th>
                              <th style={{ padding: '12px' }}>Total Amount</th>
                              <th style={{ padding: '12px' }}>Tax (8%)</th>
                              <th style={{ padding: '12px' }}>Due Date</th>
                              <th style={{ padding: '12px' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {invoices.map((inv: any) => (
                              <tr key={inv.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                <td style={{ padding: '12px', fontWeight: '700', color: '#0F172A', fontFamily: 'monospace' }}>{inv.id}</td>
                                <td style={{ padding: '12px', fontWeight: '600' }}>{inv.customer}</td>
                                <td style={{ padding: '12px', fontWeight: '700', color: '#15803D' }}>{inv.amount}</td>
                                <td style={{ padding: '12px', color: '#64748B' }}>{inv.taxAmount}</td>
                                <td style={{ padding: '12px', color: '#475569' }}>{inv.dueDate}</td>
                                <td style={{ padding: '12px' }}>
                                  <span style={{ backgroundColor: inv.status === 'PAID' ? '#DCFCE7' : inv.status === 'OVERDUE' ? '#FEE2E2' : '#EFF6FF', color: inv.status === 'PAID' ? '#15803D' : inv.status === 'OVERDUE' ? '#B91C1C' : '#1D4ED8', padding: '2px 8px', borderRadius: '12px', fontWeight: '600', fontSize: '11px' }}>{inv.status}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {financeSubTab === 'claims' && (
                      <div>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '700' }}>Trade Claims & Credit Notes Ledger</h3>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                              <th style={{ padding: '12px' }}>Claim ID</th>
                              <th style={{ padding: '12px' }}>Distributor</th>
                              <th style={{ padding: '12px' }}>Promotion Scheme</th>
                              <th style={{ padding: '12px' }}>Claim Amount</th>
                              <th style={{ padding: '12px' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {claims.map((c: any) => (
                              <tr key={c.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                <td style={{ padding: '12px', fontWeight: '700', color: '#0F172A' }}>{c.id}</td>
                                <td style={{ padding: '12px' }}>{c.distributor}</td>
                                <td style={{ padding: '12px', color: '#475569' }}>{c.scheme}</td>
                                <td style={{ padding: '12px', fontWeight: '700', color: '#15803D' }}>{c.amount}</td>
                                <td style={{ padding: '12px' }}>
                                  <span style={{ backgroundColor: c.status === 'SETTLED' ? '#DCFCE7' : '#FEF3C7', color: c.status === 'SETTLED' ? '#15803D' : '#B45309', padding: '2px 8px', borderRadius: '12px', fontWeight: '600', fontSize: '11px' }}>
                                    {c.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
    </>
  );
};
