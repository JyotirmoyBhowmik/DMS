import React from 'react';
import { useApp } from '../context/AppContext';

export const LandingLayout = () => {
  const { isAuthenticated, setIsAuthenticated, isDemoMode, setIsDemoMode, isLiveApiMode, setIsLiveApiMode, authToken, setAuthToken, loginEmail, setLoginEmail, loginPassword, setLoginPassword, authStatus, setAuthStatus, activeModal, setActiveModal, activeTab, setActiveTab, tenant, setTenant, lastRefreshed, setLastRefreshed, isRefreshing, setIsRefreshing, newSkuName, setNewSkuName, newSkuCategory, setNewSkuCategory, newSkuDistributor, setNewSkuDistributor, newSkuPrice, setNewSkuPrice, newSkuStock, setNewSkuStock, newUserEmail, setNewUserEmail, newUserRole, setNewUserRole, newUserStatus, setNewUserStatus, newTenantName, setNewTenantName, newTenantDomain, setNewTenantDomain, newBeatName, setNewBeatName, newBeatAgent, setNewBeatAgent, newBeatRadius, setNewBeatRadius, newInvoiceCustomer, setNewInvoiceCustomer, newInvoiceAmount, setNewInvoiceAmount, beatRoutes, setBeatRoutes, salesOrders, setSalesOrders, invoices, setInvoices, users, setUsers, tenants, setTenants, identitySubTab, setIdentitySubTab, inventory, setInventory, inventorySearch, setInventorySearch, sfaSubTab, setSfaSubTab, financeSubTab, setFinanceSubTab, aiPrompt, setAiPrompt, aiOutput, setAiOutput, isAiLoading, setIsAiLoading, isAuditChecking, setIsAuditChecking, auditVerdict, setAuditVerdict, configFlags, setConfigFlags, logs, setLogs, handleAddSkuSubmit, handleAddUserSubmit, handleAddTenantSubmit, handleAddBeatSubmit, handleAddInvoiceSubmit, handleLoginSubmit, handleManualRefresh, handleRunAiForecast, handleVerifyAuditChain } = useApp();
  return (
        <div style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif', backgroundColor: '#F8FAFC', minHeight: '100vh', color: '#0F172A', display: 'flex', flexDirection: 'column' }}>

          {/* TOP BRAND NAVIGATION HEADER */}
          <header style={{ height: '72px', backgroundColor: '#FFFFFF', borderBottom: '1px solid #E2E8F0', padding: '0 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: '#0F172A', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '20px' }}>
                D
              </div>
              <div>
                <div style={{ fontWeight: '800', fontSize: '18px', color: '#0F172A', letterSpacing: '-0.5px' }}>DMS & SFA PLATFORM</div>
                <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>Route-To-Market Visibility & Execution Suite</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button
                onClick={() => {
                  setIsDemoMode(true);
                  setIsAuthenticated(true);
                }}
                style={{
                  padding: '10px 20px',
                  borderRadius: '24px',
                  border: '1px solid #0284C7',
                  backgroundColor: '#E0F2FE',
                  color: '#0369A1',
                  fontWeight: '700',
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                🚀 View Instant Static Demo Site
              </button>

              <button
                onClick={() => setActiveModal('login')}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#0F172A',
                  color: '#FFFFFF',
                  fontWeight: '700',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                🔑 Sign In / Authenticate
              </button>
            </div>
          </header>

          {/* HERO BANNER SECTION (Matching User Graphic) */}
          <section style={{ backgroundColor: '#EFF6FF', borderBottom: '1px solid #DBEAFE', padding: '60px 40px', textAlign: 'center', position: 'relative' }}>
            <div style={{ maxWidth: '1100px', margin: '0 auto', textAlign: 'center' }}>
              <div style={{ display: 'inline-block', backgroundColor: '#DBEAFE', color: '#1E40AF', padding: '6px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '16px' }}>
                UNIFIED ROUTE-TO-MARKET ENTERPRISE PLATFORM
              </div>

              <h1 style={{ fontSize: '36px', fontWeight: '900', color: '#0F172A', lineHeight: '1.2', margin: '0 0 16px 0', letterSpacing: '-0.8px' }}>
                INTEGRATED DMS & SFA ECOSYSTEM:<br />ROUTE-TO-MARKET VISIBILITY & EXECUTION
              </h1>

              <p style={{ fontSize: '16px', color: '#334155', maxWidth: '780px', margin: '0 auto 36px auto', lineHeight: '1.6', fontWeight: '500' }}>
                A unified solution connecting Field Force, Distributors, and Central Management for unprecedented market agility, real-time inventory control, and predictive AI growth.
              </p>

              {/* CTA Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '40px' }}>
                <button
                  onClick={() => {
                    setIsDemoMode(true);
                    setIsAuthenticated(true);
                  }}
                  style={{ padding: '14px 32px', borderRadius: '8px', backgroundColor: '#0284C7', color: '#FFFFFF', border: 'none', fontWeight: '800', fontSize: '15px', cursor: 'pointer', boxShadow: '0 4px 14px rgba(2,132,199,0.35)' }}
                >
                  🚀 Launch Interactive Demo Site
                </button>

                <button
                  onClick={() => setActiveModal('login')}
                  style={{ padding: '14px 32px', borderRadius: '8px', backgroundColor: '#0F172A', color: '#FFFFFF', border: 'none', fontWeight: '800', fontSize: '15px', cursor: 'pointer', boxShadow: '0 4px 14px rgba(15,23,42,0.2)' }}
                >
                  🔑 Admin Credentials Sign In
                </button>
              </div>

              {/* Supported Integrations Badges (SAP, Tally, Salesforce) */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px', paddingTop: '20px', borderTop: '1px solid #BFDBFE' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Supported Integrations:</span>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '800', color: '#0369A1' }}>SAP ERP</span>
                  <span style={{ backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '800', color: '#15803D' }}>Tally Prime</span>
                  <span style={{ backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '800', color: '#2563EB' }}>Salesforce CRM</span>
                  <span style={{ backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '800', color: '#0F172A' }}>Neon Postgres</span>
                </div>
              </div>
            </div>
          </section>

          {/* 3 VISUAL ECOSYSTEM PILLARS (Matching User Image Banner) */}
          <section style={{ padding: '60px 40px', maxWidth: '1200px', margin: '0 auto', flex: 1 }}>
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: '#0F172A' }}>3 Connected Ecosystem Pillars</h2>
              <p style={{ margin: '6px 0 0 0', fontSize: '14px', color: '#64748B' }}>Real-time synchronization across Field Force, Central Management, and Distributor Hubs</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>

              {/* PILLAR 1: FIELD FORCE (SFA) */}
              <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '28px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', marginBottom: '20px' }}>
                  📍
                </div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '800', color: '#0F172A' }}>1. Field Force (SFA)</h3>
                <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748B', lineHeight: '1.5' }}>
                  Mobile Flutter Android App for Field Sales Reps with GPS geofenced check-ins, beat route navigation, and van sales.
                </p>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#334155', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                  <li>Geofenced GPS Check-In & Attendance</li>
                  <li>Beat Route & Journey Plan Navigation</li>
                  <li>On-the-Spot Mobile Van Sales Invoicing</li>
                  <li>Offline SQLite DB & AES-GCM Sync</li>
                </ul>
              </div>

              {/* PILLAR 2: CENTRAL MANAGEMENT (Web Control Hub) */}
              <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #0284C7', padding: '28px', boxShadow: '0 4px 16px rgba(2,132,199,0.12)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '-12px', right: '20px', backgroundColor: '#0284C7', color: '#FFFFFF', padding: '2px 10px', borderRadius: '10px', fontSize: '10px', fontWeight: '800' }}>CENTRAL HUB</div>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#E0F2FE', color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', marginBottom: '20px' }}>
                  📊
                </div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '800', color: '#0F172A' }}>2. Central Management</h3>
                <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748B', lineHeight: '1.5' }}>
                  Executive Control Hub with AI Demand Forecasting, Trade Claims Settlement, and SHA-256 Blockchain Audit.
                </p>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#334155', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                  <li>AI Predictive Demand & Reordering</li>
                  <li>Order Approvals & Rejections Workflow</li>
                  <li>Invoicing & Credit Notes Ledger</li>
                  <li>SHA-256 Blockchain Audit Verification</li>
                </ul>
              </div>

              {/* PILLAR 3: DISTRIBUTOR HUB (DMS Core) */}
              <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '28px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#DCFCE7', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', marginBottom: '20px' }}>
                  📦
                </div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '800', color: '#0F172A' }}>3. Distributor Hub</h3>
                <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748B', lineHeight: '1.5' }}>
                  Master Stock Ledger, Primary Sales Orders, Credit Exposure Monitoring, and Multi-Tenant RLS Security.
                </p>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#334155', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                  <li>Primary & Secondary Stock Ledger</li>
                  <li>Credit Limit & Exposure Controls</li>
                  <li>Distributor Trade Claims Submission</li>
                  <li>Postgres Row-Level Security (RLS)</li>
                </ul>
              </div>

            </div>
          </section>

          {/* LOGIN MODAL (When Sign In button is clicked) */}
          {activeModal === 'login' && (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ backgroundColor: '#FFFFFF', width: '420px', borderRadius: '12px', padding: '28px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0F172A' }}>Platform Sign In</h3>
                  <button onClick={() => setActiveModal(null)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748B' }}>✕</button>
                </div>

                {/* Quick Fill Buttons */}
                <div style={{ backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', marginBottom: '8px' }}>Preset Credentials</div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => { setLoginEmail('admin@enterprise.com'); setLoginPassword('SecureP@ss123!'); }} style={{ flex: 1, padding: '6px', borderRadius: '4px', border: 'none', backgroundColor: '#2563EB', color: '#FFFFFF', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>⚡ Admin</button>
                    <button onClick={() => { setLoginEmail('agent-001@enterprise.com'); setLoginPassword('SecureP@ss123!'); }} style={{ flex: 1, padding: '6px', borderRadius: '4px', border: 'none', backgroundColor: '#059669', color: '#FFFFFF', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>⚡ Agent</button>
                    <button onClick={() => { setLoginEmail('distributor-metro@enterprise.com'); setLoginPassword('SecureP@ss123!'); }} style={{ flex: 1, padding: '6px', borderRadius: '4px', border: 'none', backgroundColor: '#D97706', color: '#FFFFFF', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>⚡ Distributor</button>
                  </div>
                </div>

                <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '4px' }}>User Email</label>
                    <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }} />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '4px' }}>Password</label>
                    <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }} />
                  </div>

                  {authStatus && (
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#0284C7', backgroundColor: '#F8FAFC', padding: '8px', borderRadius: '6px' }}>
                      {authStatus}
                    </div>
                  )}

                  <button type="submit" style={{ padding: '12px', borderRadius: '6px', backgroundColor: '#0F172A', color: '#FFFFFF', border: 'none', fontWeight: '700', fontSize: '14px', cursor: 'pointer', marginTop: '6px' }}>
                    🔑 Sign In & Authenticate
                  </button>
                </form>
              </div>
            </div>
          )}

          <footer style={{ padding: '24px 40px', backgroundColor: '#FFFFFF', borderTop: '1px solid #E2E8F0', textAlign: 'center', fontSize: '12px', color: '#64748B' }}>
            Enterprise DMS & SFA Monorepo • Production Environment • Neon Cloud DB + Vercel Edge Serverless
          </footer>
        </div>
      )
};
