import React from 'react';
import { useApp } from '../context/AppContext';

export const AiForecasting = () => {
  const { isAuthenticated, setIsAuthenticated, isDemoMode, setIsDemoMode, isLiveApiMode, setIsLiveApiMode, authToken, setAuthToken, loginEmail, setLoginEmail, loginPassword, setLoginPassword, authStatus, setAuthStatus, activeModal, setActiveModal, activeTab, setActiveTab, tenant, setTenant, lastRefreshed, setLastRefreshed, isRefreshing, setIsRefreshing, newSkuName, setNewSkuName, newSkuCategory, setNewSkuCategory, newSkuDistributor, setNewSkuDistributor, newSkuPrice, setNewSkuPrice, newSkuStock, setNewSkuStock, newUserEmail, setNewUserEmail, newUserRole, setNewUserRole, newUserStatus, setNewUserStatus, newTenantName, setNewTenantName, newTenantDomain, setNewTenantDomain, newBeatName, setNewBeatName, newBeatAgent, setNewBeatAgent, newBeatRadius, setNewBeatRadius, newInvoiceCustomer, setNewInvoiceCustomer, newInvoiceAmount, setNewInvoiceAmount, beatRoutes, setBeatRoutes, salesOrders, setSalesOrders, invoices, setInvoices, users, setUsers, tenants, setTenants, identitySubTab, setIdentitySubTab, inventory, setInventory, inventorySearch, setInventorySearch, sfaSubTab, setSfaSubTab, financeSubTab, setFinanceSubTab, aiPrompt, setAiPrompt, aiOutput, setAiOutput, isAiLoading, setIsAiLoading, isAuditChecking, setIsAuditChecking, auditVerdict, setAuditVerdict, configFlags, setConfigFlags, logs, setLogs, handleAddSkuSubmit, handleAddUserSubmit, handleAddTenantSubmit, handleAddBeatSubmit, handleAddInvoiceSubmit, handleLoginSubmit, handleManualRefresh, handleRunAiForecast, handleVerifyAuditChain } = useApp();
  return (
    <>
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '700' }}>AI Demand Forecasting & Predictive Reordering Sandbox</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <textarea
                        rows={3}
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', outline: 'none', fontFamily: 'inherit' }}
                      />

                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <button
                          onClick={handleRunAiForecast}
                          disabled={isAiLoading}
                          style={{ padding: '10px 20px', borderRadius: '6px', backgroundColor: '#0F172A', color: '#FFFFFF', border: 'none', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}
                        >
                          {isAiLoading ? 'Executing Forecast Model...' : '⚡ Run AI Demand Forecast'}
                        </button>
                        <span style={{ fontSize: '12px', color: '#64748B' }}>Model: <strong>demand-predictor-v2 (Confidence: 95.4%)</strong></span>
                      </div>

                      {aiOutput && (
                        <div style={{ backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '16px', marginTop: '12px' }}>
                          <div style={{ fontWeight: '700', color: '#0F172A', marginBottom: '8px' }}>Forecast Simulation Output</div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', fontSize: '13px' }}>
                            <div>Predicted Volume: <strong style={{ color: '#2563EB' }}>{aiOutput.predictedDemandUnits} Units</strong></div>
                            <div>Expected Growth: <strong style={{ color: '#15803D' }}>{aiOutput.growthPercentage}</strong></div>
                            <div>Confidence: <strong>{aiOutput.confidenceInterval}</strong></div>
                            <div>Suggested Buffer: <strong>{aiOutput.suggestedBuffer}</strong></div>
                          </div>
                          <p style={{ margin: '12px 0 0 0', fontSize: '12px', color: '#475569', fontStyle: 'italic' }}>{aiOutput.insights}</p>
                        </div>
                      )}
                    </div>
                  </div>
    </>
  );
};
