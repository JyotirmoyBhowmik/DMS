import React from 'react';
import { useApp } from '../context/AppContext';

export const DmsCore = () => {
  const { isAuthenticated, setIsAuthenticated, isDemoMode, setIsDemoMode, isLiveApiMode, setIsLiveApiMode, authToken, setAuthToken, loginEmail, setLoginEmail, loginPassword, setLoginPassword, authStatus, setAuthStatus, activeModal, setActiveModal, activeTab, setActiveTab, tenant, setTenant, lastRefreshed, setLastRefreshed, isRefreshing, setIsRefreshing, newSkuName, setNewSkuName, newSkuCategory, setNewSkuCategory, newSkuDistributor, setNewSkuDistributor, newSkuPrice, setNewSkuPrice, newSkuStock, setNewSkuStock, newUserEmail, setNewUserEmail, newUserRole, setNewUserRole, newUserStatus, setNewUserStatus, newTenantName, setNewTenantName, newTenantDomain, setNewTenantDomain, newBeatName, setNewBeatName, newBeatAgent, setNewBeatAgent, newBeatRadius, setNewBeatRadius, newInvoiceCustomer, setNewInvoiceCustomer, newInvoiceAmount, setNewInvoiceAmount, beatRoutes, setBeatRoutes, salesOrders, setSalesOrders, invoices, setInvoices, users, setUsers, tenants, setTenants, identitySubTab, setIdentitySubTab, inventory, setInventory, inventorySearch, setInventorySearch, sfaSubTab, setSfaSubTab, financeSubTab, setFinanceSubTab, aiPrompt, setAiPrompt, aiOutput, setAiOutput, isAiLoading, setIsAiLoading, isAuditChecking, setIsAuditChecking, auditVerdict, setAuditVerdict, configFlags, setConfigFlags, logs, setLogs, handleAddSkuSubmit, handleAddUserSubmit, handleAddTenantSubmit, handleAddBeatSubmit, handleAddInvoiceSubmit, handleLoginSubmit, handleManualRefresh, handleRunAiForecast, handleVerifyAuditChain } = useApp();
  return (
    <>
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>DMS Master Catalog & Inventory Control</h3>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <input
                          type="text"
                          placeholder="Search SKU or Product Name..."
                          value={inventorySearch}
                          onChange={(e) => setInventorySearch(e.target.value)}
                          style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #CBD5E1', width: '260px', fontSize: '13px', outline: 'none' }}
                        />
                        <button
                          onClick={() => setActiveModal('add-sku')}
                          style={{ padding: '8px 14px', borderRadius: '6px', backgroundColor: '#2563EB', color: '#FFFFFF', border: 'none', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}
                        >
                          + Add New SKU
                        </button>
                      </div>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                          <th style={{ padding: '12px' }}>SKU Code</th>
                          <th style={{ padding: '12px' }}>Product Description</th>
                          <th style={{ padding: '12px' }}>Category</th>
                          <th style={{ padding: '12px' }}>Distributor</th>
                          <th style={{ padding: '12px' }}>Stock Qty</th>
                          <th style={{ padding: '12px' }}>Unit Price</th>
                          <th style={{ padding: '12px' }}>Stock Alert</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inventory
                          .filter((item: any) => item.name.toLowerCase().includes(inventorySearch.toLowerCase()) || item.sku.toLowerCase().includes(inventorySearch.toLowerCase()))
                          .map((item: any) => {
                            const isLowStock = item.stock <= item.minThreshold;
                            return (
                              <tr key={item.sku} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                <td style={{ padding: '12px', fontWeight: '700', color: '#0F172A' }}>{item.sku}</td>
                                <td style={{ padding: '12px', fontWeight: '600' }}>{item.name}</td>
                                <td style={{ padding: '12px', color: '#475569' }}>{item.category}</td>
                                <td style={{ padding: '12px', color: '#2563EB' }}>{item.distributor}</td>
                                <td style={{ padding: '12px', fontWeight: '700' }}>{item.stock} Units</td>
                                <td style={{ padding: '12px' }}>${item.price.toFixed(2)}</td>
                                <td style={{ padding: '12px' }}>
                                  <span style={{ backgroundColor: isLowStock ? '#FEF3C7' : '#DCFCE7', color: isLowStock ? '#B45309' : '#15803D', padding: '2px 8px', borderRadius: '12px', fontWeight: '600', fontSize: '11px' }}>
                                    {isLowStock ? 'LOW STOCK ALERT' : 'OPTIMAL'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
    </>
  );
};
