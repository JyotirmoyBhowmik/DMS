import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { DesignTokens } from '@dms/pkg-ui-shared';

// Helper to generate dynamic UUIDs for simulation
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const App = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'telemetry' | 'dms' | 'sfa' | 'ai' | 'audit' | 'identity'>('overview');
  const [tenant, setTenant] = useState('Global Distribution Corp');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(new Date().toLocaleTimeString());

  // Simulated Identity Management state
  const [users, setUsers] = useState([
    { id: '1', email: 'admin@enterprise.com', status: 'ACTIVE', roles: 'admin', lastLogin: '2026-06-01 09:12' },
    { id: '2', email: 'agent-uuid-4444@enterprise.com', status: 'ACTIVE', roles: 'agent', lastLogin: '2026-06-01 11:15' },
    { id: '3', email: 'distributor-metro@enterprise.com', status: 'ACTIVE', roles: 'distributor', lastLogin: '2026-05-30 18:44' },
    { id: '4', email: 'guest@enterprise.com', status: 'SUSPENDED', roles: 'guest', lastLogin: '2026-05-25 14:02' }
  ]);

  const [roles, setRoles] = useState([
    { id: '1', name: 'admin', description: 'Full system administrator access', isSystem: true },
    { id: '2', name: 'agent', description: 'Sales force agent field access', isSystem: true },
    { id: '3', name: 'distributor', description: 'Distributor inventory and orders access', isSystem: true },
    { id: '4', name: 'guest', description: 'Read-only access to dashboard data', isSystem: false }
  ]);

  const [permissions, setPermissions] = useState([
    { id: '1', name: 'orders:create', resource: 'orders', action: 'create', description: 'Create and submit purchase orders' },
    { id: '2', name: 'orders:read', resource: 'orders', action: 'read', description: 'Read purchase orders' },
    { id: '3', name: 'inventory:write', resource: 'inventory', action: 'write', description: 'Update inventory levels' },
    { id: '4', name: 'users:manage', resource: 'users', action: 'manage', description: 'Create and manage users and roles' }
  ]);

  const [tenants, setTenants] = useState([
    { id: '00000000-0000-0000-0000-000000000001', name: 'Global Distribution Corp', status: 'ACTIVE' },
    { id: '00000000-0000-0000-0000-000000000002', name: 'Metro Retailers Inc', status: 'ACTIVE' },
    { id: '00000000-0000-0000-0000-000000000003', name: 'Elite Wholesalers Ltd', status: 'SUSPENDED' }
  ]);

  const [mfaDevices, setMfaDevices] = useState([
    { id: '1', userId: 'admin@enterprise.com', type: 'TOTP', isActive: true, lastUsedAt: '2026-06-01 09:12' },
    { id: '2', userId: 'agent-uuid-4444@enterprise.com', type: 'TOTP', isActive: true, lastUsedAt: '2026-06-01 11:15' },
    { id: '3', userId: 'distributor-metro@enterprise.com', type: 'SMS', isActive: false, lastUsedAt: null }
  ]);

  const [identitySubTab, setIdentitySubTab] = useState<'users' | 'roles' | 'tenants' | 'permissions' | 'mfa'>('users');
  const [identityEditId, setIdentityEditId] = useState<string | null>(null);
  const [identityFormOpen, setIdentityFormOpen] = useState(false);
  const [identityFormData, setIdentityFormData] = useState<any>({});

  // Inventory list state for DMS tab
  const [inventoryFilter, setInventoryFilter] = useState<'all' | 'alert' | 'instock'>('all');
  const [inventorySearch, setInventorySearch] = useState('');
  
  // Simulated database records
  const [inventory, setInventory] = useState([
    { sku: 'SKU-FMCG-001', name: 'Premium Sunflower Oil 1L', category: 'Cooking Oil', stock: 120, minThreshold: 150, price: 12.50 },
    { sku: 'SKU-FMCG-002', name: 'Whole Wheat Atta 5kg', category: 'Flour', stock: 450, minThreshold: 200, price: 8.90 },
    { sku: 'SKU-FMCG-003', name: 'Refined Sugar 2kg', category: 'Sweetener', stock: 85, minThreshold: 100, price: 3.20 },
    { sku: 'SKU-FMCG-004', name: 'Basmati Rice 5kg', category: 'Rice', stock: 320, minThreshold: 100, price: 18.00 },
    { sku: 'SKU-FMCG-005', name: 'Assam Tea Leaves 500g', category: 'Beverages', stock: 40, minThreshold: 80, price: 4.50 },
    { sku: 'SKU-FMCG-006', name: 'Iodized Table Salt 1kg', category: 'Salt', stock: 800, minThreshold: 250, price: 0.80 },
  ]);

  // Simulated AI Sandbox state
  const [aiPrompt, setAiPrompt] = useState('Forecast demand for SKU-FMCG-001 in Zone A based on past month visit frequencies.');
  const [selectedModel, setSelectedModel] = useState('model-gpt4');
  const [aiOutput, setAiOutput] = useState<any>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Simulated Audit ledger blocks
  const [auditChain, setAuditChain] = useState([
    { block: 1, action: 'TENANT_ONBOARDED', timestamp: '2026-05-31 10:00:24', hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', prevHash: '0000000000000000000000000000000000000000000000000000000000000000', user: 'system_root' },
    { block: 2, action: 'ORDER_PLACED', timestamp: '2026-05-31 11:14:52', hash: '4f9a08e178b0f209cd0c73be48bfcd32ab4826d9cf1e27a92fbcd821a8cd34a2', prevHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', user: 'agent-uuid-4444' },
    { block: 3, action: 'INVENTORY_REALLOCATED', timestamp: '2026-05-31 12:45:01', hash: '87ba8d234a9ef1c27a9cdbe4203da826dcd87b219fa82ebc829e12cd98c2ab48', prevHash: '4f9a08e178b0f209cd0c73be48bfcd32ab4826d9cf1e27a92fbcd821a8cd34a2', user: 'distributor-metro' },
    { block: 4, action: 'ROLE_ASSIGNED', timestamp: '2026-05-31 14:02:18', hash: 'a10b42fcd890eaef1c2bc7e42d87e0293ca8bdf76b92a4a75e2cdbc82ea8910b', prevHash: '87ba8d234a9ef1c27a9cdbe4203da826dcd87b219fa82ebc829e12cd98c2ab48', user: 'admin-uuid-5555' }
  ]);
  const [isAuditChecking, setIsAuditChecking] = useState(false);
  const [auditVerdict, setAuditVerdict] = useState<string | null>(null);

  // Microservices details with mock live states
  const [services, setServices] = useState([
    { name: 'api-gateway', status: 'healthy', latency: '24ms', cpu: '8%', ram: '142MB', reqs: '14,290/hr' },
    { name: 'ai-gateway-service', status: 'healthy', latency: '76ms', cpu: '18%', ram: '280MB', reqs: '124/hr' },
    { name: 'sfa-service', status: 'healthy', latency: '42ms', cpu: '11%', ram: '198MB', reqs: '8,410/hr' },
    { name: 'dms-core-service', status: 'healthy', latency: '38ms', cpu: '14%', ram: '210MB', reqs: '11,280/hr' },
    { name: 'identity-service', status: 'healthy', latency: '15ms', cpu: '4%', ram: '98MB', reqs: '3,210/hr' },
    { name: 'sync-service', status: 'healthy', latency: '65ms', cpu: '9%', ram: '156MB', reqs: '950/hr' },
    { name: 'file-service', status: 'healthy', latency: '52ms', cpu: '6%', ram: '112MB', reqs: '320/hr' },
    { name: 'forecasting-service', status: 'healthy', latency: '112ms', cpu: '22%', ram: '320MB', reqs: '42/hr' },
    { name: 'notification-service', status: 'healthy', latency: '29ms', cpu: '5%', ram: '104MB', reqs: '4,820/hr' },
    { name: 'recommendation-service', status: 'healthy', latency: '89ms', cpu: '16%', ram: '245MB', reqs: '2,910/hr' },
    { name: 'report-service', status: 'healthy', latency: '142ms', cpu: '12%', ram: '180MB', reqs: '85/hr' },
    { name: 'audit-service', status: 'healthy', latency: '21ms', cpu: '7%', ram: '124MB', reqs: '15,640/hr' },
  ]);

  // Terminal logging output simulation
  const [logs, setLogs] = useState<string[]>([
    `[${new Date().toLocaleTimeString()}] [SYSTEM] Control Center Dashboard successfully initialized.`,
    `[${new Date().toLocaleTimeString()}] [API-GATEWAY] Secure validation JWT cache check completed in 4ms.`,
    `[${new Date().toLocaleTimeString()}] [AUDIT-SERVICE] SHA-256 chain verified up to block 4.`
  ]);

  // Simulate real-time monitoring metric changes
  useEffect(() => {
    const timer = setInterval(() => {
      // Randomly tweak latency and load metrics of services
      setServices(prev => prev.map(s => ({
        ...s,
        latency: `${Math.round(parseInt(s.latency) * (0.9 + Math.random() * 0.2))}ms`,
        cpu: `${Math.round(parseInt(s.cpu) * (0.8 + Math.random() * 0.4))}%`,
      })));

      // Add dynamic logs
      const servicesNames = ['API-GATEWAY', 'SFA-SERVICE', 'SYNC-SERVICE', 'AUDIT-SERVICE', 'NOTIFICATION-SERVICE'];
      const randomSvc = servicesNames[Math.floor(Math.random() * servicesNames.length)];
      const logTemplates = [
        `Tenant '${tenant}' JWT Token authenticated successfully.`,
        `Route match resolved for GET /api/v1/orders in 2ms.`,
        `Cryptographic outbox check executed cleanly. 0 pending tasks.`,
        `Processed events log synchronized in-memory database partition.`,
        `Rendered Order Confirmation email template to user-uuid-3333.`
      ];
      const randomLog = `[${new Date().toLocaleTimeString()}] [${randomSvc}] ${logTemplates[Math.floor(Math.random() * logTemplates.length)]}`;
      
      setLogs(prev => [randomLog, ...prev.slice(0, 19)]);
    }, 4000);

    return () => clearInterval(timer);
  }, [tenant]);

  // Handle Refreshing of Telemetry state manually
  const handleRefreshTelemetry = () => {
    setIsRefreshing(true);
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] [SYSTEM] Triggered manual telemetry verification sweep.`, ...prev]);
    
    setTimeout(() => {
      setIsRefreshing(false);
      setLastRefreshed(new Date().toLocaleTimeString());
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] [SYSTEM] Sweep complete. 12/12 microservices online.`, ...prev]);
    }, 1200);
  };

  // Perform a simulated AI forecast Sandbox invoke
  const handleInvokeAiSandbox = () => {
    setIsAiLoading(true);
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] [AI-GATEWAY-SERVICE] Dispatching prompt to model ${selectedModel}...`, ...prev]);
    
    setTimeout(() => {
      setIsAiLoading(false);
      const responses: Record<string, any> = {
        'model-gpt4': {
          prediction: 'FMCG analysis forecasts a stock depletion on SKU-FMCG-001 inside Zone A in 8 days due to a 23% frequency increase in agent check-ins.',
          confidence: 0.92,
          tokens: 72,
          cost: 0.00216
        },
        'model-gemini': {
          prediction: 'Gemini 1.5 Pro predicts strong sales volume growth (↑ 15%) for Cooking Oils in Southern sectors, recommendation: increase safety inventory by 30%.',
          confidence: 0.88,
          tokens: 142,
          cost: 0.00112
        },
        'model-internal-v1': {
          prediction: 'DMS Demand Predictor v2.1 (Internal): Projected weekly outbound target = 485 units based on seasonal distributor trends.',
          confidence: 0.81,
          tokens: 41,
          cost: 0.0
        }
      };
      setAiOutput(responses[selectedModel]);
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] [AI-GATEWAY-SERVICE] Model inference successful. Latency 78ms.`, ...prev]);
    }, 1000);
  };

  // Perform cryptographic audit verifier simulation
  const handleRunAuditVerify = () => {
    setIsAuditChecking(true);
    setAuditVerdict(null);
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] [AUDIT-SERVICE] Initializing blockchain ledger integrity scan...`, ...prev]);
    
    setTimeout(() => {
      setIsAuditChecking(false);
      setAuditVerdict('VERIFIED COMPLIANT');
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] [AUDIT-SERVICE] HASHCHAIN INTEGRITY SECURE: verified blocks 1 through 4 successfully.`, ...prev]);
    }, 1500);
  };

  // Filter Inventory based on search & buttons
  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(inventorySearch.toLowerCase()) || 
                          item.sku.toLowerCase().includes(inventorySearch.toLowerCase());
    
    if (inventoryFilter === 'all') return matchesSearch;
    if (inventoryFilter === 'alert') return matchesSearch && item.stock < item.minThreshold;
    if (inventoryFilter === 'instock') return matchesSearch && item.stock >= item.minThreshold;
    return matchesSearch;
  });

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: DesignTokens.colors.background,
      color: DesignTokens.colors.text,
      fontFamily: DesignTokens.typography.fontFamily,
      display: 'flex',
      flexDirection: 'column',
      backgroundImage: 'radial-gradient(circle at 50% 10%, rgba(30, 58, 138, 0.25) 0%, transparent 60%)'
    }}>
      {/* Top Navigation Bar */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: `${DesignTokens.spacing.sm} ${DesignTokens.spacing.lg}`,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Custom SVG Logo */}
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="url(#logoGrad)" />
            <path d="M8 20L13 13L18 16L24 10" stroke="#F8FAFC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="24" cy="10" r="2" fill="#10B981" />
            <defs>
              <linearGradient id="logoGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                <stop stopColor="#3B82F6" />
                <stop offset="1" stopColor="#1E3A8A" />
              </linearGradient>
            </defs>
          </svg>
          <div>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 800, letterSpacing: '0.03em', color: '#60A5FA' }}>
              ANTIGRAVITY CONTROL CENTER
            </h1>
            <p style={{ margin: 0, opacity: 0.6, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Enterprise DMS & SFA Monorepo Control Unit
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#94A3B8' }}>
            <span>Tenant context:</span>
            <select 
              value={tenant} 
              onChange={(e) => setTenant(e.target.value)}
              style={{
                backgroundColor: 'rgba(30, 41, 59, 0.8)',
                color: '#60A5FA',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '4px 8px',
                borderRadius: '6px',
                outline: 'none',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              <option value="Global Distribution Corp">Global Distribution Corp</option>
              <option value="Metro Wholesale Ltd">Metro Wholesale Ltd</option>
              <option value="Apex Retail Brands">Apex Retail Brands</option>
            </select>
          </div>
          <button 
            onClick={handleRefreshTelemetry}
            disabled={isRefreshing}
            style={{
              backgroundColor: isRefreshing ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
              color: '#60A5FA',
              border: '1px solid rgba(96, 165, 250, 0.3)',
              padding: '6px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            <span style={{ display: 'inline-block', animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }}>🔄</span>
            {isRefreshing ? 'Sweeping...' : 'Sweep Telemetry'}
          </button>
        </div>
      </header>

      {/* Main Layout Area */}
      <div style={{ display: 'flex', flex: 1 }}>
        
        {/* Sidebar Navigation */}
        <aside style={{
          width: '240px',
          borderRight: '1px solid rgba(255, 255, 255, 0.05)',
          backgroundColor: 'rgba(10, 15, 30, 0.4)',
          padding: DesignTokens.spacing.md,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, opacity: 0.4, textTransform: 'uppercase', letterSpacing: '0.1em', paddingLeft: '8px', marginBottom: '8px' }}>
              Monitore & Direct
            </span>
            
            {[
              { id: 'overview', label: 'Overview Hub', icon: '📊' },
              { id: 'telemetry', label: 'Service Telemetry', icon: '⚡' },
              { id: 'dms', label: 'DMS Core Management', icon: '🏢' },
              { id: 'sfa', label: 'SFA Field Tracking', icon: '📍' },
              { id: 'ai', label: 'AI Forecasting Hub', icon: '🧠' },
              { id: 'audit', label: 'Cryptographic Audit', icon: '🛡️' },
              { id: 'identity', label: 'Identity & Security', icon: '🔐' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: activeTab === tab.id ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                  color: activeTab === tab.id ? '#60A5FA' : '#94A3B8',
                  fontSize: '13px',
                  fontWeight: activeTab === tab.id ? 700 : 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Sidebar Footer Info */}
          <div style={{
            backgroundColor: 'rgba(255,255,255,0.03)',
            padding: '10px',
            borderRadius: '8px',
            fontSize: '10px',
            border: '1px solid rgba(255,255,255,0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.6 }}>
              <span>Build integrity:</span>
              <span style={{ color: '#10B981', fontWeight: 'bold' }}>STABLE</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.6 }}>
              <span>Sweep state:</span>
              <span>12/12 online</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.6 }}>
              <span>Last Refreshed:</span>
              <span>{lastRefreshed}</span>
            </div>
          </div>
        </aside>

        {/* Content Pane */}
        <main style={{ flex: 1, padding: DesignTokens.spacing.lg, overflowY: 'auto' }}>
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>Overview Control Hub</h2>
                  <p style={{ margin: '4px 0 0 0', opacity: 0.6, fontSize: '13px' }}>
                    Aggregate performance metrics and compliance indexes across all business nodes.
                  </p>
                </div>
                <div style={{ opacity: 0.6, fontSize: '12px' }}>
                  Live Data Sync: <span style={{ color: '#10B981', fontWeight: 600 }}>Active</span>
                </div>
              </div>

              {/* KPI Cards Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px'
              }}>
                {[
                  { title: 'Primary Sales Volume', value: '$142,520', change: '↑ 12.4%', text: 'vs last week', color: '#10B981', grad: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, transparent 100%)' },
                  { title: 'Field Visit Compliance', value: '98.2%', change: '↑ 1.5%', text: 'Geofenced check-ins', color: '#10B981', grad: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, transparent 100%)' },
                  { title: 'Sync Queue Backlog', value: '0', change: 'NORMAL', text: 'Online active sync', color: '#60A5FA', grad: 'linear-gradient(135deg, rgba(96, 165, 250, 0.1) 0%, transparent 100%)' },
                  { title: 'Audit Integrity Hash', value: 'VERIFIED', change: 'SECURE', text: 'Blocks 1-4 validation', color: '#10B981', grad: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, transparent 100%)' }
                ].map((kpi, idx) => (
                  <div key={idx} style={{
                    background: 'rgba(30, 41, 59, 0.4)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '12px',
                    padding: '20px',
                    backgroundImage: kpi.grad,
                    position: 'relative'
                  }}>
                    <h3 style={{ margin: 0, fontSize: '11px', textTransform: 'uppercase', color: '#94A3B8', letterSpacing: '0.05em' }}>
                      {kpi.title}
                    </h3>
                    <div style={{ fontSize: '28px', fontWeight: 800, margin: '12px 0 4px 0', color: '#F8FAFC' }}>
                      {kpi.value}
                    </div>
                    <div style={{ fontSize: '11px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{ color: kpi.color, fontWeight: 700 }}>{kpi.change}</span>
                      <span style={{ opacity: 0.5 }}>{kpi.text}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Graphic analytics simulation and charts */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                gap: '20px'
              }}>
                {/* Custom Graph 1: Sales Growth */}
                <div style={{
                  backgroundColor: 'rgba(30, 41, 59, 0.25)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '14px',
                  padding: '20px'
                }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 700, color: '#F1F5F9' }}>
                    Sales Order Volume Trend (7 Days)
                  </h3>
                  
                  {/* Custom CSS Bar Chart */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '140px', padding: '10px 0' }}>
                    {[
                      { day: 'Mon', val: '60px', amt: '$12k' },
                      { day: 'Tue', val: '45px', amt: '$9k' },
                      { day: 'Wed', val: '75px', amt: '$15k' },
                      { day: 'Thu', val: '95px', amt: '$19k' },
                      { day: 'Fri', val: '110px', amt: '$22k' },
                      { day: 'Sat', val: '30px', amt: '$6k' },
                      { day: 'Sun', val: '40px', amt: '$8k' }
                    ].map((bar, index) => (
                      <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '12%' }}>
                        <span style={{ fontSize: '9px', opacity: 0.5, marginBottom: '4px' }}>{bar.amt}</span>
                        <div style={{
                          height: bar.val,
                          width: '100%',
                          backgroundColor: '#3B82F6',
                          background: 'linear-gradient(to top, #1D4ED8, #60A5FA)',
                          borderRadius: '4px 4px 0 0',
                          transition: 'height 0.5s ease-out'
                        }}></div>
                        <span style={{ fontSize: '11px', opacity: 0.6, marginTop: '8px' }}>{bar.day}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Custom Graph 2: Load distribution */}
                <div style={{
                  backgroundColor: 'rgba(30, 41, 59, 0.25)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '14px',
                  padding: '20px'
                }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 700, color: '#F1F5F9' }}>
                    Upstream Services Network Load Comparison
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[
                      { service: 'api-gateway', share: 92, label: '9.2k req/min' },
                      { service: 'dms-core-service', share: 74, label: '7.4k req/min' },
                      { service: 'sfa-service', share: 55, label: '5.5k req/min' },
                      { service: 'audit-service', share: 45, label: '4.5k req/min' }
                    ].map((bar, index) => (
                      <div key={index}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 600 }}>{bar.service}</span>
                          <span style={{ opacity: 0.6 }}>{bar.label}</span>
                        </div>
                        <div style={{ height: '8px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${bar.share}%`,
                            height: '100%',
                            backgroundColor: '#10B981',
                            background: 'linear-gradient(to right, #047857, #10B981)',
                            borderRadius: '4px'
                          }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Log Panel */}
              <div style={{
                backgroundColor: 'rgba(10, 15, 25, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '10px',
                padding: '16px',
                fontFamily: 'monospace',
                fontSize: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', marginBottom: '12px', opacity: 0.6 }}>
                  <span>📡 LIVE GATEWAY TRAFFIC STREAM</span>
                  <span>Sweep Rate: 4s</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '120px', overflowY: 'hidden', color: '#67E8F9' }}>
                  {logs.map((log, index) => (
                    <div key={index} style={{ opacity: Math.max(0.3, 1 - index * 0.18) }}>{log}</div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SERVICE TELEMETRY */}
          {activeTab === 'telemetry' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>Service Telemetry Grid</h2>
                <p style={{ margin: '4px 0 0 0', opacity: 0.6, fontSize: '13px' }}>
                  Real-time health, latency, CPU usage, and network throughput of the 12 core microservices.
                </p>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '16px'
              }}>
                {services.map((svc) => (
                  <div key={svc.name} style={{
                    backgroundColor: 'rgba(30, 41, 59, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#60A5FA' }}>@{svc.name}</span>
                      
                      {/* Blinking healthy dot */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: '#10B981',
                          boxShadow: '0 0 8px #10B981',
                          display: 'inline-block'
                        }}></span>
                        <span style={{ fontSize: '11px', color: '#10B981', fontWeight: 'bold' }}>{svc.status}</span>
                      </div>
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '8px',
                      fontSize: '11px',
                      backgroundColor: 'rgba(15,23,42,0.4)',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      opacity: 0.8
                    }}>
                      <div>Latency: <strong style={{ color: '#F59E0B' }}>{svc.latency}</strong></div>
                      <div>Thruput: <strong>{svc.reqs}</strong></div>
                      <div>CPU Load: <strong style={{ color: '#67E8F9' }}>{svc.cpu}</strong></div>
                      <div>Memory: <strong>{svc.ram}</strong></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: DMS CORE MANAGEMENT */}
          {activeTab === 'dms' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>DMS Core Management</h2>
                <p style={{ margin: '4px 0 0 0', opacity: 0.6, fontSize: '13px' }}>
                  Manage multi-tenant inventory reserves, warehouse catalogs, and active distributor records.
                </p>
              </div>

              {/* Filters & Search */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'rgba(30, 41, 59, 0.25)',
                padding: '12px 16px',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.05)'
              }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[
                    { id: 'all', label: 'All Products' },
                    { id: 'alert', label: 'Low Stock Alerts' },
                    { id: 'instock', label: 'In Stock' }
                  ].map(btn => (
                    <button
                      key={btn.id}
                      onClick={() => setInventoryFilter(btn.id as any)}
                      style={{
                        backgroundColor: inventoryFilter === btn.id ? '#3B82F6' : 'rgba(255,255,255,0.05)',
                        color: inventoryFilter === btn.id ? '#FFFFFF' : '#94A3B8',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 600,
                        transition: 'all 0.15s'
                      }}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
                <input 
                  type="text" 
                  placeholder="Search SKU or Name..."
                  value={inventorySearch}
                  onChange={(e) => setInventorySearch(e.target.value)}
                  style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    color: '#F8FAFC',
                    border: '1px solid rgba(255,255,255,0.1)',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    outline: 'none',
                    fontSize: '12px',
                    width: '200px'
                  }}
                />
              </div>

              {/* Inventory Table */}
              <div style={{
                backgroundColor: 'rgba(30, 41, 59, 0.15)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '12px',
                overflow: 'hidden'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'rgba(15, 23, 42, 0.5)', color: '#94A3B8', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <th style={{ padding: '12px 16px' }}>SKU Code</th>
                      <th style={{ padding: '12px 16px' }}>Product Name</th>
                      <th style={{ padding: '12px 16px' }}>Category</th>
                      <th style={{ padding: '12px 16px' }}>Stock Level</th>
                      <th style={{ padding: '12px 16px' }}>Safety Threshold</th>
                      <th style={{ padding: '12px 16px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInventory.map((item) => {
                      const isLowStock = item.stock < item.minThreshold;
                      return (
                        <tr key={item.sku} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background-color 0.15s' }}>
                          <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#60A5FA' }}>{item.sku}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 500 }}>{item.name}</td>
                          <td style={{ padding: '12px 16px', opacity: 0.7 }}>{item.category}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 'bold', color: isLowStock ? '#EF4444' : '#F8FAFC' }}>{item.stock} units</td>
                          <td style={{ padding: '12px 16px', opacity: 0.7 }}>{item.minThreshold} units</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{
                              backgroundColor: isLowStock ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                              color: isLowStock ? '#F87171' : '#34D399',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              border: `1px solid ${isLowStock ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`
                            }}>
                              {isLowStock ? '⚠️ LOW STOCK' : '✅ ADEQUATE'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: SFA FIELD TRACKING */}
          {activeTab === 'sfa' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>SFA Field Tracking</h2>
                <p style={{ margin: '4px 0 0 0', opacity: 0.6, fontSize: '13px' }}>
                  Track field agent order feeds, visit schedules, and GPS boundary compliance.
                </p>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                gap: '20px'
              }}>
                {/* Recent Orders placed via mobile */}
                <div style={{
                  backgroundColor: 'rgba(30, 41, 59, 0.2)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '12px',
                  padding: '20px'
                }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#60A5FA' }}>Live Sales Order Stream</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[
                      { id: 'ORD-2026-904', distributor: 'Metro Wholesale', amt: '$12,450', time: '10 min ago', status: 'In Transit' },
                      { id: 'ORD-2026-903', distributor: 'City FMCG Connect', amt: '$8,290', time: '42 min ago', status: 'Confirmed' },
                      { id: 'ORD-2026-902', distributor: 'Apex Retail Stores', amt: '$3,400', time: '2 hrs ago', status: 'Completed' },
                      { id: 'ORD-2026-901', distributor: 'Rural Connect distributor', amt: '$1,850', time: '4 hrs ago', status: 'Completed' },
                    ].map((order) => (
                      <div key={order.id} style={{
                        backgroundColor: 'rgba(15,23,42,0.4)',
                        padding: '12px',
                        borderRadius: '8px',
                        borderLeft: '4px solid #3B82F6',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div>
                          <div style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '13px' }}>{order.id}</div>
                          <div style={{ fontSize: '11px', opacity: 0.6, marginTop: '2px' }}>{order.distributor} • {order.time}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{order.amt}</div>
                          <span style={{ fontSize: '10px', color: order.status === 'Completed' ? '#34D399' : '#60A5FA', opacity: 0.8 }}>{order.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sales Visits GPS check-in logs */}
                <div style={{
                  backgroundColor: 'rgba(30, 41, 59, 0.2)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '12px',
                  padding: '20px'
                }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#60A5FA' }}>GPS Geofence Visit Logs</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[
                      { agent: 'Rajesh Kumar', outlet: 'ABC Retail Outlet', time: '11:14 AM', dist: '12m (Compliant)', status: 'COMPLIANT' },
                      { agent: 'Arun Singh', outlet: 'Sunshine Mart', time: '10:45 AM', dist: '8m (Compliant)', status: 'COMPLIANT' },
                      { agent: 'Sanjay Dutt', outlet: 'Royal Provisions', time: '09:20 AM', dist: '482m (Invalid)', status: 'FAILED' },
                    ].map((visit, idx) => (
                      <div key={idx} style={{
                        backgroundColor: 'rgba(15,23,42,0.4)',
                        padding: '12px',
                        borderRadius: '8px',
                        borderLeft: `4px solid ${visit.status === 'COMPLIANT' ? '#10B981' : '#EF4444'}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div>
                          <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{visit.outlet}</div>
                          <div style={{ fontSize: '11px', opacity: 0.6, marginTop: '2px' }}>Agent: {visit.agent} • {visit.time}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{
                            backgroundColor: visit.status === 'COMPLIANT' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: visit.status === 'COMPLIANT' ? '#34D399' : '#F87171',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '9px',
                            fontWeight: 'bold',
                            display: 'block',
                            marginBottom: '4px'
                          }}>
                            {visit.status}
                          </span>
                          <span style={{ fontSize: '10px', opacity: 0.6 }}>{visit.dist}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: AI FORECASTING HUB */}
          {activeTab === 'ai' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>AI Forecasting Sandbox</h2>
                <p style={{ margin: '4px 0 0 0', opacity: 0.6, fontSize: '13px' }}>
                  Directly run simulated micro-inferences against the registered OpenTarget, OpenAI, or Internal models.
                </p>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 2fr',
                gap: '20px'
              }}>
                {/* Model Selector Card */}
                <div style={{
                  backgroundColor: 'rgba(30, 41, 59, 0.25)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '12px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}>
                  <h3 style={{ margin: 0, fontSize: '15px', color: '#60A5FA' }}>Configure Model</h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', opacity: 0.6 }}>Select Model Engine</label>
                    <select 
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      style={{
                        backgroundColor: 'rgba(15,23,42,0.6)',
                        color: '#F8FAFC',
                        border: '1px solid rgba(255,255,255,0.1)',
                        padding: '8px',
                        borderRadius: '6px',
                        outline: 'none'
                      }}
                    >
                      <option value="model-gpt4">gpt-4 (OpenAI)</option>
                      <option value="model-gemini">gemini-1.5-pro (Vertex)</option>
                      <option value="model-internal-v1">dms-demand-predictor (Internal ML)</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', opacity: 0.6 }}>AI Prompt</label>
                    <textarea 
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      rows={4}
                      style={{
                        backgroundColor: 'rgba(15,23,42,0.6)',
                        color: '#F8FAFC',
                        border: '1px solid rgba(255,255,255,0.1)',
                        padding: '8px',
                        borderRadius: '6px',
                        outline: 'none',
                        fontSize: '12px',
                        fontFamily: 'inherit',
                        resize: 'none'
                      }}
                    />
                  </div>

                  <button
                    onClick={handleInvokeAiSandbox}
                    disabled={isAiLoading}
                    style={{
                      backgroundColor: '#3B82F6',
                      color: '#FFFFFF',
                      border: 'none',
                      padding: '10px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '12px'
                    }}
                  >
                    {isAiLoading ? 'Invoking AI Gateway...' : 'Execute Inference'}
                  </button>
                </div>

                {/* Output Screen */}
                <div style={{
                  backgroundColor: 'rgba(30, 41, 59, 0.15)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '12px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: '280px'
                }}>
                  <div>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#60A5FA' }}>Inference Output Terminal</h3>
                    
                    {isAiLoading ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '140px', gap: '12px' }}>
                        <span style={{ fontSize: '24px', animation: 'spin 1.5s linear infinite', display: 'inline-block' }}>⚙️</span>
                        <span style={{ fontSize: '12px', opacity: 0.6 }}>Executing token analysis...</span>
                      </div>
                    ) : aiOutput ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{
                          backgroundColor: 'rgba(15,23,42,0.5)',
                          padding: '14px',
                          borderRadius: '8px',
                          borderLeft: '4px solid #10B981',
                          fontSize: '13px',
                          lineHeight: '1.5'
                        }}>
                          {aiOutput.prediction}
                        </div>
                        
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, 1fr)',
                          gap: '12px',
                          fontSize: '11px',
                          opacity: 0.8
                        }}>
                          <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            Confidence Score: <strong style={{ color: '#10B981', fontSize: '12px', display: 'block', marginTop: '2px' }}>{aiOutput.confidence * 100}%</strong>
                          </div>
                          <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            Tokens Used: <strong style={{ color: '#60A5FA', fontSize: '12px', display: 'block', marginTop: '2px' }}>{aiOutput.tokens}</strong>
                          </div>
                          <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            Estimated cost: <strong style={{ color: '#F59E0B', fontSize: '12px', display: 'block', marginTop: '2px' }}>${aiOutput.cost}</strong>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '140px', opacity: 0.4, fontSize: '13px' }}>
                        Configure the model in the left panel and click "Execute Inference" to simulate a live AI request.
                      </div>
                    )}
                  </div>

                  <div style={{ fontSize: '10px', opacity: 0.4, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
                    Secure route verified via: @ai-gateway-service • Vault connection: ENABLED
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: CRYPTOGRAPHIC AUDIT LOGS */}
          {activeTab === 'audit' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>Cryptographic Audit Ledger</h2>
                  <p style={{ margin: '4px 0 0 0', opacity: 0.6, fontSize: '13px' }}>
                    Visualizing the SOC 2 tamper-evident security hash chain logs (`SHA-256(currentLog + prevHash)`).
                  </p>
                </div>
                <button
                  onClick={handleRunAuditVerify}
                  disabled={isAuditChecking}
                  style={{
                    backgroundColor: '#10B981',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {isAuditChecking ? 'Verifying Chain...' : 'Verify Hash Chain'}
                </button>
              </div>

              {/* Integrity status banner */}
              {auditVerdict && (
                <div style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <span style={{ fontSize: '20px' }}>🛡️</span>
                  <div>
                    <strong style={{ color: '#34D399', fontSize: '14px' }}>LEDGER HASHCHAIN INTEGRITY CHECK: PASSED</strong>
                    <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '2px' }}>
                      Verified all 4 blocks in the current chain partition against SHA-256 historical cryptographic salts. Zero tampering detected.
                    </div>
                  </div>
                </div>
              )}

              {/* Chained Blocks Visualization */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                position: 'relative'
              }}>
                {auditChain.map((block, idx) => (
                  <div key={block.block} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                    {/* The Block Card */}
                    <div style={{
                      width: '100%',
                      backgroundColor: 'rgba(30, 41, 59, 0.25)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      borderRadius: '12px',
                      padding: '16px',
                      backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.01) 0%, transparent 100%)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', marginBottom: '10px' }}>
                        <span style={{ fontWeight: 800, color: '#3B82F6', fontSize: '13px' }}>BLOCK #{block.block}</span>
                        <span style={{ fontSize: '11px', opacity: 0.6 }}>{block.timestamp}</span>
                      </div>

                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 2fr',
                        gap: '12px',
                        fontSize: '12px'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div>Action: <strong style={{ color: '#E2E8F0' }}>{block.action}</strong></div>
                          <div>Triggered By: <span style={{ fontFamily: 'monospace', opacity: 0.8 }}>{block.user}</span></div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: '1px solid rgba(255,255,255,0.05)', paddingLeft: '16px' }}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <span style={{ opacity: 0.5 }}>Current Hash:</span>
                            <span style={{ fontFamily: 'monospace', color: '#22D3EE', fontSize: '11px' }}>{block.hash.slice(0, 36)}...</span>
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <span style={{ opacity: 0.5 }}>Previous Hash:</span>
                            <span style={{ fontFamily: 'monospace', opacity: 0.5, fontSize: '11px' }}>{block.prevHash.slice(0, 36)}...</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Cryptographic Link arrow between blocks */}
                    {idx < auditChain.length - 1 && (
                      <div style={{
                        height: '24px',
                        width: '2px',
                        backgroundColor: 'rgba(59, 130, 246, 0.3)',
                        margin: '4px 0',
                        position: 'relative'
                      }}>
                        <div style={{
                          position: 'absolute',
                          bottom: '-4px',
                          left: '-4px',
                          borderLeft: '5px solid transparent',
                          borderRight: '5px solid transparent',
                          borderTop: '6px solid rgba(59, 130, 246, 0.4)'
                        }}></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 7: IDENTITY & SECURITY */}
          {activeTab === 'identity' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>Identity & Security Management</h2>
                  <p style={{ margin: '4px 0 0 0', opacity: 0.6, fontSize: '13px' }}>
                    Administer Users, Roles, Permissions, Tenants, and MFA Devices.
                  </p>
                </div>
                
                <button
                  onClick={() => {
                    setIdentityEditId(null);
                    setIdentityFormData({});
                    setIdentityFormOpen(true);
                  }}
                  style={{
                    backgroundColor: '#3B82F6',
                    color: '#FFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                >
                  ➕ Add {identitySubTab === 'mfa' ? 'MFA Device' : identitySubTab.slice(0, -1).toUpperCase()}
                </button>
              </div>

              {/* Sub-tabs selector */}
              <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '12px' }}>
                {[
                  { id: 'users', label: 'Users' },
                  { id: 'roles', label: 'Roles' },
                  { id: 'tenants', label: 'Tenants' },
                  { id: 'permissions', label: 'Permissions' },
                  { id: 'mfa', label: 'MFA Devices' }
                ].map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => {
                      setIdentitySubTab(sub.id as any);
                      setIdentityFormOpen(false);
                    }}
                    style={{
                      backgroundColor: identitySubTab === sub.id ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                      color: identitySubTab === sub.id ? '#60A5FA' : '#94A3B8',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>

              {/* Main Content: List & Form */}
              <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
                
                {/* List Table container */}
                <div style={{
                  flex: identityFormOpen ? 2 : 1,
                  backgroundColor: 'rgba(30, 41, 59, 0.25)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '12px',
                  padding: '20px',
                  overflowX: 'auto'
                }}>
                  {identitySubTab === 'users' && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                          <th style={{ padding: '12px 8px', opacity: 0.5 }}>Email</th>
                          <th style={{ padding: '12px 8px', opacity: 0.5 }}>Roles</th>
                          <th style={{ padding: '12px 8px', opacity: 0.5 }}>Status</th>
                          <th style={{ padding: '12px 8px', opacity: 0.5 }}>Last Login</th>
                          <th style={{ padding: '12px 8px', opacity: 0.5 }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map(u => (
                          <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '12px 8px', fontWeight: 600 }}>{u.email}</td>
                            <td style={{ padding: '12px 8px' }}>{u.roles}</td>
                            <td style={{ padding: '12px 8px' }}>
                              <span style={{
                                backgroundColor: u.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                color: u.status === 'ACTIVE' ? '#10B981' : '#EF4444',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 700
                              }}>{u.status}</span>
                            </td>
                            <td style={{ padding: '12px 8px', opacity: 0.8 }}>{u.lastLogin}</td>
                            <td style={{ padding: '12px 8px' }}>
                              <button onClick={() => {
                                setIdentityEditId(u.id);
                                setIdentityFormData(u);
                                setIdentityFormOpen(true);
                              }} style={{ background: 'none', border: 'none', color: '#3B82F6', cursor: 'pointer', marginRight: '8px' }}>Edit</button>
                              <button onClick={() => setUsers(users.filter(x => x.id !== u.id))} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer' }}>Delete</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {identitySubTab === 'roles' && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                          <th style={{ padding: '12px 8px', opacity: 0.5 }}>Name</th>
                          <th style={{ padding: '12px 8px', opacity: 0.5 }}>Description</th>
                          <th style={{ padding: '12px 8px', opacity: 0.5 }}>Type</th>
                          <th style={{ padding: '12px 8px', opacity: 0.5 }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {roles.map(r => (
                          <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '12px 8px', fontWeight: 600 }}>{r.name}</td>
                            <td style={{ padding: '12px 8px', opacity: 0.8 }}>{r.description}</td>
                            <td style={{ padding: '12px 8px' }}>{r.isSystem ? 'System' : 'Custom'}</td>
                            <td style={{ padding: '12px 8px' }}>
                              <button onClick={() => {
                                setIdentityEditId(r.id);
                                setIdentityFormData(r);
                                setIdentityFormOpen(true);
                              }} style={{ background: 'none', border: 'none', color: '#3B82F6', cursor: 'pointer', marginRight: '8px' }}>Edit</button>
                              <button onClick={() => setRoles(roles.filter(x => x.id !== r.id))} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer' }}>Delete</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {identitySubTab === 'tenants' && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                          <th style={{ padding: '12px 8px', opacity: 0.5 }}>Name</th>
                          <th style={{ padding: '12px 8px', opacity: 0.5 }}>ID</th>
                          <th style={{ padding: '12px 8px', opacity: 0.5 }}>Status</th>
                          <th style={{ padding: '12px 8px', opacity: 0.5 }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tenants.map(t => (
                          <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '12px 8px', fontWeight: 600 }}>{t.name}</td>
                            <td style={{ padding: '12px 8px', fontFamily: 'monospace', fontSize: '11px', opacity: 0.8 }}>{t.id}</td>
                            <td style={{ padding: '12px 8px' }}>
                              <span style={{
                                backgroundColor: t.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                color: t.status === 'ACTIVE' ? '#10B981' : '#EF4444',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 700
                              }}>{t.status}</span>
                            </td>
                            <td style={{ padding: '12px 8px' }}>
                              <button onClick={() => {
                                setIdentityEditId(t.id);
                                setIdentityFormData(t);
                                setIdentityFormOpen(true);
                              }} style={{ background: 'none', border: 'none', color: '#3B82F6', cursor: 'pointer', marginRight: '8px' }}>Edit</button>
                              <button onClick={() => setTenants(tenants.filter(x => x.id !== t.id))} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer' }}>Delete</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {identitySubTab === 'permissions' && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                          <th style={{ padding: '12px 8px', opacity: 0.5 }}>Name</th>
                          <th style={{ padding: '12px 8px', opacity: 0.5 }}>Resource</th>
                          <th style={{ padding: '12px 8px', opacity: 0.5 }}>Action</th>
                          <th style={{ padding: '12px 8px', opacity: 0.5 }}>Description</th>
                          <th style={{ padding: '12px 8px', opacity: 0.5 }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {permissions.map(p => (
                          <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '12px 8px', fontWeight: 600 }}>{p.name}</td>
                            <td style={{ padding: '12px 8px' }}>{p.resource}</td>
                            <td style={{ padding: '12px 8px' }}>{p.action}</td>
                            <td style={{ padding: '12px 8px', opacity: 0.8 }}>{p.description}</td>
                            <td style={{ padding: '12px 8px' }}>
                              <button onClick={() => {
                                setIdentityEditId(p.id);
                                setIdentityFormData(p);
                                setIdentityFormOpen(true);
                              }} style={{ background: 'none', border: 'none', color: '#3B82F6', cursor: 'pointer', marginRight: '8px' }}>Edit</button>
                              <button onClick={() => setPermissions(permissions.filter(x => x.id !== p.id))} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer' }}>Delete</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {identitySubTab === 'mfa' && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                          <th style={{ padding: '12px 8px', opacity: 0.5 }}>User ID / Email</th>
                          <th style={{ padding: '12px 8px', opacity: 0.5 }}>Type</th>
                          <th style={{ padding: '12px 8px', opacity: 0.5 }}>Status</th>
                          <th style={{ padding: '12px 8px', opacity: 0.5 }}>Last Used</th>
                          <th style={{ padding: '12px 8px', opacity: 0.5 }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mfaDevices.map(m => (
                          <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '12px 8px', fontWeight: 600 }}>{m.userId}</td>
                            <td style={{ padding: '12px 8px' }}>{m.type}</td>
                            <td style={{ padding: '12px 8px' }}>
                              <span style={{
                                backgroundColor: m.isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                color: m.isActive ? '#10B981' : '#EF4444',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 700
                              }}>{m.isActive ? 'Active' : 'Inactive'}</span>
                            </td>
                            <td style={{ padding: '12px 8px', opacity: 0.8 }}>{m.lastUsedAt || 'Never'}</td>
                            <td style={{ padding: '12px 8px' }}>
                              <button onClick={() => {
                                setIdentityEditId(m.id);
                                setIdentityFormData(m);
                                setIdentityFormOpen(true);
                              }} style={{ background: 'none', border: 'none', color: '#3B82F6', cursor: 'pointer', marginRight: '8px' }}>Edit</button>
                              <button onClick={() => setMfaDevices(mfaDevices.filter(x => x.id !== m.id))} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer' }}>Delete</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Form Editor panel */}
                {identityFormOpen && (
                  <div style={{
                    flex: 1,
                    backgroundColor: 'rgba(30, 41, 59, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px'
                  }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                      {identityEditId ? 'Edit' : 'Create'} {identitySubTab.slice(0, -1).toUpperCase()}
                    </h3>

                    {identitySubTab === 'users' && (
                      <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ fontSize: '11px', opacity: 0.6 }}>Email Address</label>
                          <input
                            type="email"
                            value={identityFormData.email || ''}
                            onChange={e => setIdentityFormData({ ...identityFormData, email: e.target.value })}
                            style={{ backgroundColor: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px', color: '#FFF' }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ fontSize: '11px', opacity: 0.6 }}>Roles (comma separated)</label>
                          <input
                            type="text"
                            value={identityFormData.roles || ''}
                            onChange={e => setIdentityFormData({ ...identityFormData, roles: e.target.value })}
                            style={{ backgroundColor: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px', color: '#FFF' }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ fontSize: '11px', opacity: 0.6 }}>Status</label>
                          <select
                            value={identityFormData.status || 'ACTIVE'}
                            onChange={e => setIdentityFormData({ ...identityFormData, status: e.target.value })}
                            style={{ backgroundColor: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px', color: '#FFF' }}
                          >
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="SUSPENDED">SUSPENDED</option>
                          </select>
                        </div>
                      </>
                    )}

                    {identitySubTab === 'roles' && (
                      <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ fontSize: '11px', opacity: 0.6 }}>Role Name</label>
                          <input
                            type="text"
                            value={identityFormData.name || ''}
                            onChange={e => setIdentityFormData({ ...identityFormData, name: e.target.value })}
                            style={{ backgroundColor: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px', color: '#FFF' }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ fontSize: '11px', opacity: 0.6 }}>Description</label>
                          <input
                            type="text"
                            value={identityFormData.description || ''}
                            onChange={e => setIdentityFormData({ ...identityFormData, description: e.target.value })}
                            style={{ backgroundColor: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px', color: '#FFF' }}
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="checkbox"
                            checked={!!identityFormData.isSystem}
                            onChange={e => setIdentityFormData({ ...identityFormData, isSystem: e.target.checked })}
                          />
                          <label style={{ fontSize: '11px', opacity: 0.6 }}>Is System Role</label>
                        </div>
                      </>
                    )}

                    {identitySubTab === 'tenants' && (
                      <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ fontSize: '11px', opacity: 0.6 }}>Tenant Name</label>
                          <input
                            type="text"
                            value={identityFormData.name || ''}
                            onChange={e => setIdentityFormData({ ...identityFormData, name: e.target.value })}
                            style={{ backgroundColor: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px', color: '#FFF' }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ fontSize: '11px', opacity: 0.6 }}>Status</label>
                          <select
                            value={identityFormData.status || 'ACTIVE'}
                            onChange={e => setIdentityFormData({ ...identityFormData, status: e.target.value })}
                            style={{ backgroundColor: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px', color: '#FFF' }}
                          >
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="SUSPENDED">SUSPENDED</option>
                          </select>
                        </div>
                      </>
                    )}

                    {identitySubTab === 'permissions' && (
                      <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ fontSize: '11px', opacity: 0.6 }}>Permission Name</label>
                          <input
                            type="text"
                            value={identityFormData.name || ''}
                            onChange={e => setIdentityFormData({ ...identityFormData, name: e.target.value })}
                            style={{ backgroundColor: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px', color: '#FFF' }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ fontSize: '11px', opacity: 0.6 }}>Resource</label>
                          <input
                            type="text"
                            value={identityFormData.resource || ''}
                            onChange={e => setIdentityFormData({ ...identityFormData, resource: e.target.value })}
                            style={{ backgroundColor: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px', color: '#FFF' }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ fontSize: '11px', opacity: 0.6 }}>Action</label>
                          <input
                            type="text"
                            value={identityFormData.action || ''}
                            onChange={e => setIdentityFormData({ ...identityFormData, action: e.target.value })}
                            style={{ backgroundColor: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px', color: '#FFF' }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ fontSize: '11px', opacity: 0.6 }}>Description</label>
                          <input
                            type="text"
                            value={identityFormData.description || ''}
                            onChange={e => setIdentityFormData({ ...identityFormData, description: e.target.value })}
                            style={{ backgroundColor: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px', color: '#FFF' }}
                          />
                        </div>
                      </>
                    )}

                    {identitySubTab === 'mfa' && (
                      <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ fontSize: '11px', opacity: 0.6 }}>User ID / Email</label>
                          <input
                            type="text"
                            value={identityFormData.userId || ''}
                            onChange={e => setIdentityFormData({ ...identityFormData, userId: e.target.value })}
                            style={{ backgroundColor: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px', color: '#FFF' }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ fontSize: '11px', opacity: 0.6 }}>MFA Type</label>
                          <select
                            value={identityFormData.type || 'TOTP'}
                            onChange={e => setIdentityFormData({ ...identityFormData, type: e.target.value })}
                            style={{ backgroundColor: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px', color: '#FFF' }}
                          >
                            <option value="TOTP">TOTP</option>
                            <option value="SMS">SMS</option>
                            <option value="EMAIL">EMAIL</option>
                          </select>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="checkbox"
                            checked={!!identityFormData.isActive}
                            onChange={e => setIdentityFormData({ ...identityFormData, isActive: e.target.checked })}
                          />
                          <label style={{ fontSize: '11px', opacity: 0.6 }}>Is MFA Device Active</label>
                        </div>
                      </>
                    )}

                    {/* Action buttons for Form */}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <button
                        onClick={() => {
                          const list = identitySubTab === 'users' ? users :
                                       identitySubTab === 'roles' ? roles :
                                       identitySubTab === 'tenants' ? tenants :
                                       identitySubTab === 'permissions' ? permissions : mfaDevices;
                          const setList = identitySubTab === 'users' ? setUsers :
                                          identitySubTab === 'roles' ? setRoles :
                                          identitySubTab === 'tenants' ? setTenants :
                                          identitySubTab === 'permissions' ? setPermissions : setMfaDevices;

                          if (identityEditId) {
                            // Update item
                            setList(list.map(item => item.id === identityEditId ? { ...item, ...identityFormData } : item));
                          } else {
                            // Create item
                            const newItem = {
                              id: generateUUID(),
                              ...identityFormData
                            };
                            setList([...list, newItem as any]);
                          }
                          setIdentityFormOpen(false);
                        }}
                        style={{
                          flex: 1,
                          backgroundColor: '#10B981',
                          color: '#FFF',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '8px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setIdentityFormOpen(false)}
                        style={{
                          flex: 1,
                          backgroundColor: 'rgba(255,255,255,0.08)',
                          color: '#FFF',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '8px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Global CSS Inject to support spinning animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
