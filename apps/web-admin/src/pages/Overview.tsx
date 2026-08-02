import React from 'react';
import { useApp } from '../context/AppContext';

export const Overview = () => {
  const { isAuthenticated, setIsAuthenticated, isDemoMode, setIsDemoMode, isLiveApiMode, setIsLiveApiMode, authToken, setAuthToken, loginEmail, setLoginEmail, loginPassword, setLoginPassword, authStatus, setAuthStatus, activeModal, setActiveModal, activeTab, setActiveTab, tenant, setTenant, lastRefreshed, setLastRefreshed, isRefreshing, setIsRefreshing, newSkuName, setNewSkuName, newSkuCategory, setNewSkuCategory, newSkuDistributor, setNewSkuDistributor, newSkuPrice, setNewSkuPrice, newSkuStock, setNewSkuStock, newUserEmail, setNewUserEmail, newUserRole, setNewUserRole, newUserStatus, setNewUserStatus, newTenantName, setNewTenantName, newTenantDomain, setNewTenantDomain, newBeatName, setNewBeatName, newBeatAgent, setNewBeatAgent, newBeatRadius, setNewBeatRadius, newInvoiceCustomer, setNewInvoiceCustomer, newInvoiceAmount, setNewInvoiceAmount, beatRoutes, setBeatRoutes, salesOrders, setSalesOrders, invoices, setInvoices, users, setUsers, tenants, setTenants, identitySubTab, setIdentitySubTab, inventory, setInventory, inventorySearch, setInventorySearch, sfaSubTab, setSfaSubTab, financeSubTab, setFinanceSubTab, aiPrompt, setAiPrompt, aiOutput, setAiOutput, isAiLoading, setIsAiLoading, isAuditChecking, setIsAuditChecking, auditVerdict, setAuditVerdict, configFlags, setConfigFlags, logs, setLogs, handleAddSkuSubmit, handleAddUserSubmit, handleAddTenantSubmit, handleAddBeatSubmit, handleAddInvoiceSubmit, handleLoginSubmit, handleManualRefresh, handleRunAiForecast, handleVerifyAuditChain } = useApp();
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                    {/* WHITE & GREY METRIC CARDS */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                      {[
                        { label: 'PRIMARY SALES VOLUME', value: '$142,520', change: '+12.4% vs last week', status: 'positive', sub: 'Across 12 Distributors' },
                        { label: 'FIELD VISIT COMPLIANCE', value: '98.2%', change: '+1.5% Geofenced check-ins', status: 'positive', sub: '34 Active Field Reps' },
                        { label: 'SYNC QUEUE BACKLOG', value: '0 Pending', change: 'NORMAL Online active sync', status: 'neutral', sub: 'Mobile SQLite Offlines' },
                        { label: 'AUDIT INTEGRITY HASH', value: 'VERIFIED', change: 'SECURE Blocks 1-4 validation', status: 'positive', sub: 'Append-Only Ledger' }
                      ].map((card: any, idx: number) => (
                        <div key={idx} style={{ backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                          <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>{card.label}</div>
                          <div style={{ fontSize: '28px', fontWeight: '800', color: '#0F172A', margin: '8px 0 4px 0' }}>{card.value}</div>
                          <div style={{ fontSize: '12px', fontWeight: '600', color: card.status === 'positive' ? '#15803D' : '#475569' }}>{card.change}</div>
                          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>{card.sub}</div>
                        </div>
                      ))}
                    </div>

                    {/* CHARTS & NETWORK LOAD */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '20px' }}>

                      {/* 7-Day Trend Chart */}
                      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#0F172A' }}>Sales Order Volume Trend (7 Days)</h3>
                          <span style={{ fontSize: '12px', color: '#2563EB', fontWeight: '600' }}>Live Stream</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', height: '180px', paddingTop: '20px' }}>
                          {[
                            { day: 'Mon', val: '$12k', height: '55%' },
                            { day: 'Tue', val: '$9k', height: '40%' },
                            { day: 'Wed', val: '$15k', height: '70%' },
                            { day: 'Thu', val: '$19k', height: '85%' },
                            { day: 'Fri', val: '$22k', height: '95%' },
                            { day: 'Sat', val: '$6k', height: '30%' },
                            { day: 'Sun', val: '$8k', height: '38%' }
                          ].map((item: any, i: number) => (
                            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', height: '100%', justifyContent: 'flex-end' }}>
                              <span style={{ fontSize: '11px', fontWeight: '600', color: '#475569' }}>{item.val}</span>
                              <div style={{ width: '100%', backgroundColor: '#2563EB', borderRadius: '4px 4px 0 0', height: item.height, transition: 'height 0.3s ease' }}></div>
                              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>{item.day}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Service Load Status */}
                      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: '700', color: '#0F172A' }}>Upstream Services Load</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          {[
                            { name: 'api-gateway', load: '9.2k req/min', pct: '92%' },
                            { name: 'dms-core-service', load: '7.4k req/min', pct: '74%' },
                            { name: 'sfa-service', load: '5.5k req/min', pct: '55%' },
                            { name: 'audit-service', load: '4.5k req/min', pct: '45%' },
                            { name: 'pricing-service', load: '3.1k req/min', pct: '31%' }
                          ].map((srv: any, idx: number) => (
                            <div key={idx}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                                <span>{srv.name}</span>
                                <span>{srv.load}</span>
                              </div>
                              <div style={{ width: '100%', height: '6px', backgroundColor: '#F1F5F9', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ width: srv.pct, height: '100%', backgroundColor: '#059669', borderRadius: '3px' }}></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>

                    {/* LIVE TRAFFIC LOGS */}
                    <div style={{ backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#0F172A' }}>Live Gateway Traffic Stream</h3>
                        <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748B' }}>Sweep Rate: 4s</span>
                      </div>

                      <div style={{ backgroundColor: '#0F172A', borderRadius: '8px', padding: '16px', fontFamily: 'monospace', fontSize: '12px', color: '#38BDF8', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {logs.map((line: any, idx: number) => (
                          <div key={idx} style={{ opacity: 1 - idx * 0.12 }}>{line}</div>
                        ))}
                      </div>
                    </div>

                  </div>
    </>
  );
};
