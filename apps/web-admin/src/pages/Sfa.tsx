import React from 'react';
import { useApp } from '../context/AppContext';

export const Sfa = () => {
  const { isAuthenticated, setIsAuthenticated, isDemoMode, setIsDemoMode, isLiveApiMode, setIsLiveApiMode, authToken, setAuthToken, loginEmail, setLoginEmail, loginPassword, setLoginPassword, authStatus, setAuthStatus, activeModal, setActiveModal, activeTab, setActiveTab, tenant, setTenant, lastRefreshed, setLastRefreshed, isRefreshing, setIsRefreshing, newSkuName, setNewSkuName, newSkuCategory, setNewSkuCategory, newSkuDistributor, setNewSkuDistributor, newSkuPrice, setNewSkuPrice, newSkuStock, setNewSkuStock, newUserEmail, setNewUserEmail, newUserRole, setNewUserRole, newUserStatus, setNewUserStatus, newTenantName, setNewTenantName, newTenantDomain, setNewTenantDomain, newBeatName, setNewBeatName, newBeatAgent, setNewBeatAgent, newBeatRadius, setNewBeatRadius, newInvoiceCustomer, setNewInvoiceCustomer, newInvoiceAmount, setNewInvoiceAmount, beatRoutes, setBeatRoutes, salesOrders, setSalesOrders, invoices, setInvoices, users, setUsers, tenants, setTenants, identitySubTab, setIdentitySubTab, inventory, setInventory, inventorySearch, setInventorySearch, sfaSubTab, setSfaSubTab, financeSubTab, setFinanceSubTab, aiPrompt, setAiPrompt, aiOutput, setAiOutput, isAiLoading, setIsAiLoading, isAuditChecking, setIsAuditChecking, auditVerdict, setAuditVerdict, configFlags, setConfigFlags, logs, setLogs, handleAddSkuSubmit, handleAddUserSubmit, handleAddTenantSubmit, handleAddBeatSubmit, handleAddInvoiceSubmit, handleLoginSubmit, handleManualRefresh, handleRunAiForecast, handleVerifyAuditChain } = useApp();
  const fieldVisits: any[] = [{id: 'vis-1', agent: 'Agent Sarah', outlet: 'City Supermarket', time: '10:15 AM', location: 'Verified GPS Match'}];
  const vanSales: any[] = [{id: 'van-1', agent: 'Agent Mark', vehicle: 'VAN-77X', inventoryValue: '$12,500', status: 'ON_ROUTE'}];
  return (
    <>
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px', marginBottom: '20px' }}>
                      {[
                        { id: 'visits', label: `Geofenced Field Visits (${fieldVisits.length})` },
                        { id: 'van', label: `Van Sales (${vanSales.length})` },
                        { id: 'beats', label: `Beat Routes (${beatRoutes.length})` },
                        { id: 'approvals', label: `Order Approvals (${salesOrders.length})` }
                      ].map((sub: any) => (
                        <button
                          key={sub.id}
                          onClick={() => setSfaSubTab(sub.id as any)}
                          style={{
                            padding: '8px 16px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: sfaSubTab === sub.id ? '#0F172A' : '#F1F5F9',
                            color: sfaSubTab === sub.id ? '#FFFFFF' : '#475569',
                            fontWeight: '600',
                            fontSize: '13px',
                            cursor: 'pointer'
                          }}
                        >
                          {sub.label}
                        </button>
                      ))}
                    </div>

                    {sfaSubTab === 'beats' && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>Beat Map & Beat Route Management</h3>
                          <button
                            onClick={() => setActiveModal('add-beat')}
                            style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: '#2563EB', color: '#FFFFFF', border: 'none', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}
                          >
                            + Create Beat Route
                          </button>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                              <th style={{ padding: '12px' }}>Beat Code</th>
                              <th style={{ padding: '12px' }}>Route Name</th>
                              <th style={{ padding: '12px' }}>Assigned Agent</th>
                              <th style={{ padding: '12px' }}>Outlets Covered</th>
                              <th style={{ padding: '12px' }}>Geofence Radius</th>
                              <th style={{ padding: '12px' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {beatRoutes.map((b: any) => (
                              <tr key={b.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                <td style={{ padding: '12px', fontWeight: '700', color: '#0F172A', fontFamily: 'monospace' }}>{b.code}</td>
                                <td style={{ padding: '12px', fontWeight: '600' }}>{b.name}</td>
                                <td style={{ padding: '12px', color: '#2563EB' }}>{b.agent}</td>
                                <td style={{ padding: '12px' }}>{b.outletsCount} Retail Stores</td>
                                <td style={{ padding: '12px', color: '#64748B' }}>{b.radiusKm}</td>
                                <td style={{ padding: '12px' }}>
                                  <span style={{ backgroundColor: b.status === 'ACTIVE' ? '#DCFCE7' : '#F1F5F9', color: b.status === 'ACTIVE' ? '#15803D' : '#475569', padding: '2px 8px', borderRadius: '12px', fontWeight: '600', fontSize: '11px' }}>{b.status}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {sfaSubTab === 'approvals' && (
                      <div>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '700' }}>Sales Order Approval Workflow</h3>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                              <th style={{ padding: '12px' }}>Order ID</th>
                              <th style={{ padding: '12px' }}>Retail Outlet</th>
                              <th style={{ padding: '12px' }}>Field Agent</th>
                              <th style={{ padding: '12px' }}>Order Amount</th>
                              <th style={{ padding: '12px' }}>Status</th>
                              <th style={{ padding: '12px' }}>Approval Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {salesOrders.map((ord: any) => (
                              <tr key={ord.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                <td style={{ padding: '12px', fontWeight: '700', color: '#0F172A' }}>{ord.id}</td>
                                <td style={{ padding: '12px', fontWeight: '600' }}>{ord.outlet}</td>
                                <td style={{ padding: '12px', color: '#475569' }}>{ord.agent}</td>
                                <td style={{ padding: '12px', fontWeight: '700', color: '#15803D' }}>{ord.totalAmount}</td>
                                <td style={{ padding: '12px' }}>
                                  <span style={{ backgroundColor: ord.status === 'APPROVED' ? '#DCFCE7' : '#FEF3C7', color: ord.status === 'APPROVED' ? '#15803D' : '#B45309', padding: '2px 8px', borderRadius: '12px', fontWeight: '600', fontSize: '11px' }}>{ord.status}</span>
                                </td>
                                <td style={{ padding: '12px' }}>
                                  {ord.status === 'PENDING_APPROVAL' ? (
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                      <button
                                        onClick={() => setSalesOrders(salesOrders.map((o: any) => o.id === ord.id ? { ...o, status: 'APPROVED' } : o))}
                                        style={{ padding: '4px 10px', borderRadius: '4px', backgroundColor: '#15803D', color: '#FFFFFF', border: 'none', fontWeight: '600', cursor: 'pointer', fontSize: '11px' }}
                                      >
                                        ✓ Approve
                                      </button>
                                      <button
                                        onClick={() => setSalesOrders(salesOrders.map((o: any) => o.id === ord.id ? { ...o, status: 'REJECTED' } : o))}
                                        style={{ padding: '4px 10px', borderRadius: '4px', backgroundColor: '#B91C1C', color: '#FFFFFF', border: 'none', fontWeight: '600', cursor: 'pointer', fontSize: '11px' }}
                                      >
                                        ✕ Reject
                                      </button>
                                    </div>
                                  ) : (
                                    <span style={{ fontSize: '11px', color: '#64748B' }}>Verified</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {sfaSubTab === 'visits' && (
                      <div>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#0F172A' }}>Active Geofenced Check-Ins</h4>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', textAlign: 'left' }}>
                              <th style={{ padding: '10px' }}>Agent</th>
                              <th style={{ padding: '10px' }}>Retail Outlet</th>
                              <th style={{ padding: '10px' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {fieldVisits.map((v: any) => (
                              <tr key={v.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                <td style={{ padding: '10px', fontWeight: '600' }}>{v.agent}</td>
                                <td style={{ padding: '10px' }}>{v.outlet}</td>
                                <td style={{ padding: '10px' }}>
                                  <span style={{ backgroundColor: '#DCFCE7', color: '#15803D', padding: '2px 6px', borderRadius: '4px', fontWeight: '600', fontSize: '10px' }}>{v.status}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {sfaSubTab === 'van' && (
                      <div>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#0F172A' }}>Van Sales Dispatches</h4>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', textAlign: 'left' }}>
                              <th style={{ padding: '10px' }}>Van ID</th>
                              <th style={{ padding: '10px' }}>Order Value</th>
                              <th style={{ padding: '10px' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {vanSales.map((vs: any) => (
                              <tr key={vs.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                <td style={{ padding: '10px', fontWeight: '700' }}>{vs.vanId}</td>
                                <td style={{ padding: '10px', fontWeight: '600' }}>{vs.orderValue}</td>
                                <td style={{ padding: '10px' }}>
                                  <span style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8', padding: '2px 6px', borderRadius: '4px', fontWeight: '600', fontSize: '10px' }}>{vs.status}</span>
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
