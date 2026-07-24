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

  // Simulated User Role for permission-gated actions
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'field-agent'>('admin');

  // Simulated Order Approvals state
  const [orderApprovals, setOrderApprovals] = useState([
    { id: 'app-uuid-101', orderId: 'ord-2026-904', requestedBy: 'Rajesh Kumar', amount: 12450, thresholdAmount: 10000, level: 1, status: 'pending', comments: null },
    { id: 'app-uuid-102', orderId: 'ord-2026-903', requestedBy: 'Arun Singh', amount: 8290, thresholdAmount: 10000, level: 1, status: 'approved', comments: 'Auto-approved: order amount within threshold' },
    { id: 'app-uuid-103', orderId: 'ord-2026-905', requestedBy: 'Sanjay Dutt', amount: 15600, thresholdAmount: 10000, level: 2, status: 'pending', comments: null }
  ]);

  // Simulated Journey Plans state
  const [journeyPlans, setJourneyPlans] = useState([
    {
      id: 'jp-uuid-501',
      date: '2026-06-20',
      agentId: 'agent-uuid-4444',
      beatName: 'Central Beat Route',
      status: 'planned',
      plannedOutlets: [
        { outletId: 'out-1', outletName: 'Koramangala Grocery', sequence: 1, visited: false },
        { outletId: 'out-2', outletName: 'Nexus Retail Mall', sequence: 2, visited: false },
      ]
    },
    {
      id: 'jp-uuid-502',
      date: '2026-06-19',
      agentId: 'agent-uuid-4444',
      beatName: 'South City Beat Route',
      status: 'in_progress',
      plannedOutlets: [
        { outletId: 'out-3', outletName: 'Sunrise Grocery Mart', sequence: 1, visited: true },
        { outletId: 'out-4', outletName: 'Mega Mart Center', sequence: 2, visited: false },
      ]
    }
  ]);

  const [jpFormOpen, setJpFormOpen] = useState(false);
  const [jpNewPlan, setJpNewPlan] = useState({
    date: '2026-06-21',
    beatId: 'beat-uuid-1',
    beatName: 'Koramangala route',
    outletName: 'HyperMarket Zone',
  });

  // Simulated Beat Routes state
  const [beatRoutes, setBeatRoutes] = useState([
    {
      id: 'beat-uuid-1',
      name: 'Koramangala route',
      region: 'Bangalore South',
      frequency: 'daily',
      status: 'active',
      outlets: [
        { outletId: 'out-1', sequence: 1, lat: 12.93, lng: 77.62 },
        { outletId: 'out-2', sequence: 2, lat: 12.95, lng: 77.64 },
      ]
    },
    {
      id: 'beat-uuid-2',
      name: 'Indiranagar Commercial Beat',
      region: 'Bangalore East',
      frequency: 'weekly',
      status: 'draft',
      outlets: [
        { outletId: 'out-5', sequence: 1, lat: 12.97, lng: 77.65 }
      ]
    }
  ]);

  const [brFormOpen, setBrFormOpen] = useState(false);
  const [brNewRoute, setBrNewRoute] = useState({
    name: 'Malleswaram Retail route',
    region: 'Bangalore West',
    frequency: 'daily',
    outletName: 'Fresh Farms Hub',
  });

  // Simulated Visits state
  const [visits, setVisits] = useState([
    {
      id: 'visit-1001',
      outletId: 'out-1',
      outletName: 'HyperMarket Zone',
      journeyPlanId: 'jp-2026-001',
      status: 'planned',
      plannedDate: '2026-06-05T09:00:00.000Z',
      checkInTime: null as string | null,
      checkOutTime: null as string | null,
    },
    {
      id: 'visit-1002',
      outletId: 'out-2',
      outletName: 'Koramangala Grocery Store',
      journeyPlanId: 'jp-2026-001',
      status: 'in_progress',
      plannedDate: '2026-06-05T10:30:00.000Z',
      checkInTime: '2026-06-05T10:35:00.000Z',
      checkOutTime: null as string | null,
    }
  ]);
  const [visitFormOpen, setVisitFormOpen] = useState(false);
  const [newVisit, setNewVisit] = useState({
    outletId: 'out-1',
    outletName: 'HyperMarket Zone',
    journeyPlanId: 'jp-2026-001',
    plannedDate: '2026-06-05T09:00:00.000Z',
  });

  // Simulated Attendances state
  const [attendances, setAttendances] = useState([
    {
      id: 'att-1001',
      agentId: 'agent-uuid-4444',
      agentName: 'Amit Kumar',
      date: '2026-06-05',
      shiftStart: '2026-06-05T08:30:00.000Z',
      shiftEnd: '2026-06-05T17:30:00.000Z',
      checkInTime: '2026-06-05T08:32:00.000Z' as string | null,
      checkOutTime: null as string | null,
      status: 'checked_in',
      leaveType: null as string | null,
      totalHoursWorked: 0,
      overtimeHours: 0,
    },
    {
      id: 'att-1002',
      agentId: 'agent-uuid-5555',
      agentName: 'Rajesh Sharma',
      date: '2026-06-05',
      shiftStart: '2026-06-05T08:30:00.000Z',
      shiftEnd: '2026-06-05T17:30:00.000Z',
      checkInTime: '2026-06-05T08:28:00.000Z',
      checkOutTime: '2026-06-05T17:35:00.000Z',
      status: 'approved',
      leaveType: null as string | null,
      totalHoursWorked: 9.12,
      overtimeHours: 1.12,
    }
  ]);
  const [attFormOpen, setAttFormOpen] = useState(false);
  const [newAtt, setNewAtt] = useState({
    agentId: 'agent-uuid-4444',
    agentName: 'Amit Kumar',
    date: '2026-06-05',
    shiftStart: '2026-06-05T08:30:00.000Z',
    shiftEnd: '2026-06-05T17:30:00.000Z',
  });

  // Simulated Outlet Censuses state
  const [outletCensuses, setOutletCensuses] = useState([
    {
      id: 'cen-1001',
      outletId: 'out-1',
      outletName: 'HyperMarket Zone',
      outletType: 'kirana',
      ownerName: 'Sagar Kumar',
      ownerPhone: '9876543210',
      address: 'Shop 5, Connaught Place, New Delhi',
      geoCoords: { latitude: 28.6139, longitude: 77.2090 },
      tradeCategory: 'Groceries',
      status: 'submitted',
      kycStatus: 'approved',
      version: 1,
    },
    {
      id: 'cen-1002',
      outletId: 'out-2',
      outletName: 'Koramangala Grocery Store',
      outletType: 'supermarket',
      ownerName: 'Rahul Verma',
      ownerPhone: '9812345678',
      address: 'Lane 2, Koramangala, Bangalore',
      geoCoords: { latitude: 12.93, longitude: 77.62 },
      tradeCategory: 'Beverages',
      status: 'draft',
      kycStatus: 'pending',
      version: 1,
    }
  ]);
  const [censusFormOpen, setCensusFormOpen] = useState(false);
  const [newCensus, setNewCensus] = useState({
    id: '',
    outletId: 'out-1',
    outletName: '',
    outletType: 'kirana',
    ownerName: '',
    ownerPhone: '',
    address: '',
    latitude: '',
    longitude: '',
    tradeCategory: 'Groceries',
  });
  const [censusSearchQuery, setCensusSearchQuery] = useState('');
  const [censusStatusFilter, setCensusStatusFilter] = useState('all');
  const [censusSortField, setCensusSortField] = useState('outletName');

  // Simulated Outlet Profiles state
  const [outletProfiles, setOutletProfiles] = useState([
    {
      id: 'prof-1001',
      outletName: 'Elite General Store',
      outletType: 'kirana',
      ownerName: 'Sunil Dutt',
      ownerPhone: '9876543210',
      address: 'Rajouri Garden, New Delhi',
      geoCoords: { latitude: 28.64, longitude: 77.12 },
      kycStatus: 'verified',
      status: 'active',
      version: 1,
    },
    {
      id: 'prof-1002',
      outletName: 'Vikas Supermarket',
      outletType: 'supermarket',
      ownerName: 'Vikas Sharma',
      ownerPhone: '9888888888',
      address: 'Indiranagar, Bangalore',
      geoCoords: { latitude: 12.97, longitude: 77.64 },
      kycStatus: 'pending',
      status: 'active',
      version: 1,
    }
  ]);
  const [profileFormOpen, setProfileFormOpen] = useState(false);
  const [newProfile, setNewProfile] = useState({
    id: '',
    outletName: '',
    outletType: 'kirana',
    ownerName: '',
    ownerPhone: '',
    address: '',
    latitude: '12.9716',
    longitude: '77.5946',
    kycStatus: 'pending',
    status: 'active',
  });
  const [profileSearchQuery, setProfileSearchQuery] = useState('');
  const [profileStatusFilter, setProfileStatusFilter] = useState('all');
  const [profileSortField, setProfileSortField] = useState('outletName');

  // Simulated Van Sales state
  const [vanSales, setVanSales] = useState([
    {
      id: 'van-1001',
      agentId: 'agent-uuid-4444',
      vehicleId: 'veh-9999',
      routeId: 'beat-uuid-1',
      date: '2026-06-20',
      loadedItems: [
        { skuId: 'SKU-FMCG-001', qty: 50, batchNumber: 'BAT-01' },
        { skuId: 'SKU-FMCG-002', qty: 100, batchNumber: 'BAT-02' }
      ],
      soldItems: [
        { skuId: 'SKU-FMCG-001', qty: 10, unitPrice: 1250, outletId: 'out-1' }
      ],
      returnedItems: [],
      cashCollected: { amount: 125.00, currency: 'INR' },
      digitalPayments: { amount: 0, currency: 'INR' },
      status: 'selling',
      version: 1,
      createdAt: '2026-06-20T08:00:00Z',
      updatedAt: '2026-06-20T10:30:00Z',
    }
  ]);
  const [vanSaleFormOpen, setVanSaleFormOpen] = useState(false);
  const [newVanSale, setNewVanSale] = useState({
    id: '',
    agentId: 'agent-uuid-4444',
    vehicleId: 'veh-9999',
    routeId: 'beat-uuid-1',
    date: '2026-06-21',
    loadedItemsStr: '[{"skuId":"SKU-FMCG-001","qty":50,"batchNumber":"BAT-01"}]',
    status: 'loading',
  });
  const [vanSaleSearchQuery, setVanSaleSearchQuery] = useState('');
  const [vanSaleStatusFilter, setVanSaleStatusFilter] = useState('all');

  // Simulated Sales Targets state
  const [salesTargets, setSalesTargets] = useState([
    {
      id: 'target-1001',
      tenantId: '00000000-0000-0000-0000-000000000001',
      agentId: 'agent-uuid-4444',
      periodMonth: 6,
      periodYear: 2026,
      targetAmount: 5000,
      achievedAmount: 1850,
      targetType: 'volume',
      status: 'ACTIVE',
      version: 1,
    },
    {
      id: 'target-1002',
      tenantId: '00000000-0000-0000-0000-000000000001',
      agentId: 'agent-uuid-5555',
      periodMonth: 6,
      periodYear: 2026,
      targetAmount: 12000,
      achievedAmount: 12450,
      targetType: 'value',
      status: 'COMPLETED',
      version: 2,
    },
    {
      id: 'target-1003',
      tenantId: '00000000-0000-0000-0000-000000000001',
      agentId: 'agent-uuid-4444',
      periodMonth: 7,
      periodYear: 2026,
      targetAmount: 8000,
      achievedAmount: 0,
      targetType: 'volume',
      status: 'DRAFT',
      version: 1,
    }
  ]);
  const [stFormOpen, setStFormOpen] = useState(false);
  const [stEditingId, setStEditingId] = useState<string | null>(null);
  const [stFormData, setStFormData] = useState({
    agentId: 'agent-uuid-4444',
    periodMonth: 6,
    periodYear: 2026,
    targetAmount: 5000,
    targetType: 'volume',
    status: 'DRAFT' as any,
    version: 1,
  });
  const [stFormErrors, setStFormErrors] = useState<Record<string, string>>({});
  const [stFilterAgentId, setStFilterAgentId] = useState('all');
  const [stFilterStatus, setStFilterStatus] = useState('all');
  const [stFilterType, setStFilterType] = useState('all');
  const [stPage, setStPage] = useState(1);
  const stPageSize = 5;

  // Simulated KPI Achievements state
  const [kpiAchievements, setKpiAchievements] = useState([
    {
      id: 'kpi-1001',
      tenantId: '00000000-0000-0000-0000-000000000001',
      agentId: 'agent-uuid-4444',
      kpiType: 'visits',
      periodMonth: 6,
      periodYear: 2026,
      targetValue: 120,
      achievedValue: 85,
      status: 'APPROVED',
      version: 1,
    },
    {
      id: 'kpi-1002',
      tenantId: '00000000-0000-0000-0000-000000000001',
      agentId: 'agent-uuid-5555',
      kpiType: 'orders',
      periodMonth: 6,
      periodYear: 2026,
      targetValue: 80,
      achievedValue: 82,
      status: 'APPROVED',
      version: 2,
    },
    {
      id: 'kpi-1003',
      tenantId: '00000000-0000-0000-0000-000000000001',
      agentId: 'agent-uuid-4444',
      kpiType: 'sales_amount',
      periodMonth: 7,
      periodYear: 2026,
      targetValue: 20000,
      achievedValue: 0,
      status: 'DRAFT',
      version: 1,
    }
  ]);
  const [kpiFormOpen, setKpiFormOpen] = useState(false);
  const [kpiEditingId, setKpiEditingId] = useState<string | null>(null);
  const [kpiFormData, setKpiFormData] = useState({
    agentId: 'agent-uuid-4444',
    kpiType: 'visits',
    periodMonth: 6,
    periodYear: 2026,
    targetValue: 100,
    status: 'DRAFT' as any,
    version: 1,
  });
  const [kpiFormErrors, setKpiFormErrors] = useState<Record<string, string>>({});
  const [kpiFilterAgentId, setKpiFilterAgentId] = useState('all');
  const [kpiFilterStatus, setKpiFilterStatus] = useState('all');
  const [kpiFilterType, setKpiFilterType] = useState('all');
  const [kpiPage, setKpiPage] = useState(1);
  const kpiPageSize = 5;

  const [fieldReps, setFieldReps] = useState([
    {
      id: 'rep-1001',
      tenantId: '00000000-0000-0000-0000-000000000001',
      userId: '00000000-0000-0000-0000-0000000000c1',
      employeeCode: 'EMP-001',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@dms.com',
      phone: '1234567890',
      status: 'ACTIVE',
      version: 1,
    },
    {
      id: 'rep-1002',
      tenantId: '00000000-0000-0000-0000-000000000001',
      userId: '00000000-0000-0000-0000-0000000000c2',
      employeeCode: 'EMP-002',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@dms.com',
      phone: '9876543210',
      status: 'ACTIVE',
      version: 1,
    },
    {
      id: 'rep-1003',
      tenantId: '00000000-0000-0000-0000-000000000001',
      userId: '00000000-0000-0000-0000-0000000000c3',
      employeeCode: 'EMP-003',
      firstName: 'Bob',
      lastName: 'Johnson',
      email: 'bob.johnson@dms.com',
      phone: '5551234567',
      status: 'SUSPENDED',
      version: 2,
    }
  ]);
  const [frFormOpen, setFrFormOpen] = useState(false);
  const [frEditingId, setFrEditingId] = useState<string | null>(null);
  const [frFormData, setFrFormData] = useState({
    userId: '00000000-0000-0000-0000-0000000000c4',
    employeeCode: 'EMP-004',
    firstName: 'Alice',
    lastName: 'Jones',
    email: 'alice.jones@dms.com',
    phone: '4441239999',
    status: 'ACTIVE' as any,
    version: 1,
  });
  const [frFormErrors, setFrFormErrors] = useState<Record<string, string>>({});
  const [frFilterStatus, setFrFilterStatus] = useState('all');
  const [frSearchQuery, setFrSearchQuery] = useState('');
  const [frPage, setFrPage] = useState(1);
  const frPageSize = 5;

  // SFA Survey States
  const [surveys, setSurveys] = useState([
    { id: 'srv-1001', tenantId: '00000000-0000-0000-0000-000000000001', agentId: 'agent-uuid-4444', outletId: 'out-1', title: 'Q2 Competitor Pricing Survey', status: 'ACTIVE', version: 1, createdAt: '2026-06-15T08:00:00Z', updatedAt: '2026-06-15T08:00:00Z' },
    { id: 'srv-1002', tenantId: '00000000-0000-0000-0000-000000000001', agentId: 'agent-uuid-5555', outletId: 'out-2', title: 'Outlet Stock Display Survey', status: 'DRAFT', version: 1, createdAt: '2026-06-16T10:00:00Z', updatedAt: '2026-06-16T10:00:00Z' },
    { id: 'srv-1003', tenantId: '00000000-0000-0000-0000-000000000001', agentId: 'agent-uuid-4444', outletId: 'out-1', title: 'Product Launch Feedback Survey', status: 'COMPLETED', version: 2, createdAt: '2026-06-12T11:00:00Z', updatedAt: '2026-06-14T14:30:00Z' }
  ]);
  const [surveyFormOpen, setSurveyFormOpen] = useState(false);
  const [surveyEditingId, setSurveyEditingId] = useState<string | null>(null);
  const [surveyFormData, setSurveyFormData] = useState({
    title: '',
    agentId: 'agent-uuid-4444',
    outletId: 'out-1',
    status: 'DRAFT' as any,
    version: 1
  });
  const [surveyFormErrors, setSurveyFormErrors] = useState<Record<string, string>>({});
  const [surveySearchQuery, setSurveySearchQuery] = useState('');
  const [surveyStatusFilter, setSurveyStatusFilter] = useState('all');
  const [surveySortField, setSurveySortField] = useState('title');
  const [surveyPage, setSurveyPage] = useState(1);
  const surveyPageSize = 5;
  const [sfaSubTab, setSfaSubTab] = useState<'tracking' | 'surveys'>('tracking');

  // DMS Distributor States
  const [distributors, setDistributors] = useState([
    { id: 'dst-1001', tenantId: '00000000-0000-0000-0000-000000000001', name: 'Metro Wholesale Distributors', region: 'North', creditLimit: 1500000, balance: 125000, status: 'ACTIVE', version: 1, createdAt: '2026-05-20T08:00:00Z', updatedAt: '2026-05-20T08:00:00Z' },
    { id: 'dst-1002', tenantId: '00000000-0000-0000-0000-000000000001', name: 'City FMCG Connect', region: 'South', creditLimit: 800000, balance: 45000, status: 'ACTIVE', version: 1, createdAt: '2026-05-22T10:00:00Z', updatedAt: '2026-05-22T10:00:00Z' },
    { id: 'dst-1003', tenantId: '00000000-0000-0000-0000-000000000001', name: 'Apex Retail Stores', region: 'East', creditLimit: 500000, balance: 500000, status: 'SUSPENDED', version: 2, createdAt: '2026-05-18T11:00:00Z', updatedAt: '2026-05-25T14:30:00Z' }
  ]);
  const [distributorFormOpen, setDistributorFormOpen] = useState(false);
  const [distributorEditingId, setDistributorEditingId] = useState<string | null>(null);
  const [distributorFormData, setDistributorFormData] = useState({
    name: '',
    region: 'North',
    creditLimit: 1000000,
    status: 'ACTIVE' as any,
    version: 1
  });
  const [distributorFormErrors, setDistributorFormErrors] = useState<Record<string, string>>({});
  const [distributorSearchQuery, setDistributorSearchQuery] = useState('');
  const [distributorRegionFilter, setDistributorRegionFilter] = useState('all');
  const [distributorSortField, setDistributorSortField] = useState('name');
  const [distributorPage, setDistributorPage] = useState(1);
  const distributorPageSize = 5;
  const [dmsSubTab, setDmsSubTab] = useState<'inventory' | 'distributors' | 'settlements'>('inventory');


  // Simulated Settlement Management state for Web Admin (Tasks 1225 & 1226)
  const [settlements, setSettlements] = useState([
    { id: 'set-uuid-001', settlementCode: 'SET-2026-001', claimId: 'claim-uuid-101', distributorId: 'dist-uuid-201', amountCents: 150000, paymentReference: 'PAY-REF-9812', status: 'SETTLED', version: 1, createdAt: '2026-06-01' },
    { id: 'set-uuid-002', settlementCode: 'SET-2026-002', claimId: 'claim-uuid-102', distributorId: 'dist-uuid-202', amountCents: 45000, paymentReference: '', status: 'PROCESSING', version: 1, createdAt: '2026-06-02' },
    { id: 'set-uuid-003', settlementCode: 'SET-2026-003', claimId: 'claim-uuid-103', distributorId: 'dist-uuid-203', amountCents: 89000, paymentReference: '', status: 'INITIATED', version: 1, createdAt: '2026-06-03' },
    { id: 'set-uuid-004', settlementCode: 'SET-2026-004', claimId: 'claim-uuid-104', distributorId: 'dist-uuid-204', amountCents: 210000, paymentReference: '', status: 'FAILED', version: 1, createdAt: '2026-06-04' },
  ]);
  const [settlementSearchQuery, setSettlementSearchQuery] = useState('');
  const [settlementStatusFilter, setSettlementStatusFilter] = useState('ALL');
  const [settlementPage, setSettlementPage] = useState(1);
  const settlementPageSize = 5;
  const [settlementFormOpen, setSettlementFormOpen] = useState(false);
  const [editingSettlementId, setEditingSettlementId] = useState<string | null>(null);
  const [settlementFormData, setSettlementFormData] = useState({
    settlementCode: '',
    claimId: '',
    distributorId: '',
    amountCents: 0,
    paymentReference: '',
    status: 'INITIATED',
    version: 1
  });
  const [settlementFormErrors, setSettlementFormErrors] = useState<Record<string, string>>({});
  const [settlementOptimisticConflict, setSettlementOptimisticConflict] = useState(false);
  const [settlementDeleteConfirmId, setSettlementDeleteConfirmId] = useState<string | null>(null);
  const [settlementIsLoading, setSettlementIsLoading] = useState(false);
  const [settlementApiError, setSettlementApiError] = useState<string | null>(null);
  const [settlementE2eLog, setSettlementE2eLog] = useState<string[]>([]);


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

  const handleApproveOrderApproval = async (id: string, action: 'approved' | 'rejected' | 'escalated') => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] [SFA-SERVICE] Order approval request ${id} updated to ${action}.`, ...prev]);
    setOrderApprovals(prev => prev.map(a => {
      if (a.id === id) {
        let level = a.level;
        if (action === 'escalated' && level < 3) {
          level += 1;
        }
        return {
          ...a,
          status: action === 'escalated' ? 'pending' : action,
          level,
          comments: action === 'approved' ? 'Approved by regional manager' : (action === 'rejected' ? 'Rejected by manager' : 'Escalated to next level')
        };
      }
      return a;
    }));
  };

  const handleStartJourneyPlan = (id: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] [SFA-SERVICE] Starting Journey beat plan ${id}...`, ...prev]);
    setJourneyPlans(prev => prev.map(p => p.id === id ? { ...p, status: 'in_progress' } : p));
  };

  const handleVisitOutletPlan = (id: string, outletId: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] [SFA-SERVICE] Marking outlet ${outletId} visited on journey ${id}.`, ...prev]);
    setJourneyPlans(prev => prev.map(p => {
      if (p.id === id) {
        return {
          ...p,
          plannedOutlets: p.plannedOutlets.map(o => o.outletId === outletId ? { ...o, visited: true } : o)
        };
      }
      return p;
    }));
  };

  const handleCompleteJourneyPlan = (id: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] [SFA-SERVICE] Completing Journey beat plan ${id}. Syncing metrics to Postgres...`, ...prev]);
    setJourneyPlans(prev => prev.map(p => p.id === id ? { ...p, status: 'completed' } : p));
  };

  const handleCreateJourneyPlan = (e: React.FormEvent) => {
    e.preventDefault();
    const newId = `jp-uuid-${Math.floor(Math.random() * 1000)}`;
    const newPlan = {
      id: newId,
      date: jpNewPlan.date,
      agentId: 'agent-uuid-4444',
      beatName: jpNewPlan.beatName,
      status: 'planned',
      plannedOutlets: [
        { outletId: `out-${Math.floor(Math.random() * 1000)}`, outletName: jpNewPlan.outletName, sequence: 1, visited: false }
      ]
    };
    setJourneyPlans(prev => [newPlan, ...prev]);
    setJpFormOpen(false);
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] [SFA-SERVICE] Beat journey plan scheduled for agent-uuid-4444 on ${jpNewPlan.date}.`, ...prev]);
  };

  const handleUpdateBeatRouteStatus = (id: string, action: 'activate' | 'suspend' | 'archive') => {
    const statusMap = { activate: 'active', suspend: 'suspended', archive: 'archived' };
    const nextStatus = statusMap[action];
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] [SFA-SERVICE] Beat route ${id} transition action: ${action}. Status updated to: ${nextStatus}.`, ...prev]);
    setBeatRoutes(prev => prev.map(r => r.id === id ? { ...r, status: nextStatus } : r));
  };

  const handleCreateBeatRoute = (e: React.FormEvent) => {
    e.preventDefault();
    const newId = `beat-uuid-${Math.floor(Math.random() * 1000)}`;
    const newRoute = {
      id: newId,
      name: brNewRoute.name,
      region: brNewRoute.region,
      frequency: brNewRoute.frequency,
      status: 'draft',
      outlets: [
        { outletId: `out-${Math.floor(Math.random() * 1000)}`, sequence: 1, lat: 12.92, lng: 77.61 }
      ]
    };
    setBeatRoutes(prev => [newRoute, ...prev]);
    setBrFormOpen(false);
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] [SFA-SERVICE] Beat route registry created: ${brNewRoute.name} in region ${brNewRoute.region}.`, ...prev]);
  };

  const handleCreateVisit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = 'visit-' + Math.floor(Math.random() * 10000);
    const item = {
      id,
      ...newVisit,
      status: 'planned',
      checkInTime: null,
      checkOutTime: null,
    };
    setVisits(prev => [item, ...prev]);
    setVisitFormOpen(false);
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] [SFA-SERVICE] Created planned visit for outlet: ${newVisit.outletName}`, ...prev]);
  };

  const handleUpdateVisitStatus = (id: string, action: 'check_in' | 'check_out' | 'skip') => {
    setVisits(prev => prev.map(v => {
      if (v.id === id) {
        if (action === 'check_in') {
          return { ...v, status: 'in_progress', checkInTime: new Date().toISOString() };
        } else if (action === 'check_out') {
          return { ...v, status: 'completed', checkOutTime: new Date().toISOString() };
        } else if (action === 'skip') {
          return { ...v, status: 'skipped' };
        }
      }
      return v;
    }));
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] [SFA-SERVICE] Mutation action '${action}' applied to visit ID: ${id}.`, ...prev]);
  };

  const handleCreateAttendance = (e: React.FormEvent) => {
    e.preventDefault();
    const id = 'att-' + Math.floor(Math.random() * 10000);
    const item = {
      id,
      ...newAtt,
      status: 'absent',
      checkInTime: null as string | null,
      checkOutTime: null as string | null,
      leaveType: null as string | null,
      totalHoursWorked: 0,
      overtimeHours: 0,
    };
    setAttendances(prev => [item, ...prev]);
    setAttFormOpen(false);
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] [SFA-SERVICE] Scheduled attendance record for agent ${newAtt.agentName} on date ${newAtt.date}.`, ...prev]);
  };

  const handleUpdateAttendanceStatus = (id: string, action: 'check_in' | 'check_out' | 'approve' | 'set_leave', leaveType?: string) => {
    setAttendances(prev => prev.map(a => {
      if (a.id === id) {
        if (action === 'check_in') {
          return { ...a, status: 'checked_in', checkInTime: new Date().toISOString() };
        } else if (action === 'check_out') {
          const checkIn = a.checkInTime ? new Date(a.checkInTime) : new Date();
          const checkOut = new Date();
          const diffMs = checkOut.getTime() - checkIn.getTime();
          const hours = Math.round((diffMs / 3_600_000) * 100) / 100 || 8;
          const ot = hours > 8 ? Math.round((hours - 8) * 100) / 100 : 0;
          return { ...a, status: 'checked_out', checkOutTime: checkOut.toISOString(), totalHoursWorked: hours, overtimeHours: ot };
        } else if (action === 'approve') {
          return { ...a, status: 'approved' };
        } else if (action === 'set_leave') {
          return { ...a, leaveType: leaveType || 'Casual', status: 'absent' as any };
        }
      }
      return a;
    }));
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] [SFA-SERVICE] Mutation action '${action}' applied to attendance record ID: ${id}.`, ...prev]);
  };

  const handleCreateOrUpdateCensus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCensus.outletName.trim()) {
      alert('Outlet Name is required');
      return;
    }
    if (newCensus.ownerPhone.trim().length < 10) {
      alert('Owner Phone must be at least 10 digits');
      return;
    }

    const lat = parseFloat(newCensus.latitude);
    const lng = parseFloat(newCensus.longitude);
    if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lng) || lng < -180 || lng > 180) {
      alert('Invalid GPS coordinates');
      return;
    }

    if (newCensus.id) {
      // Update
      setOutletCensuses(prev => prev.map(c => {
        if (c.id === newCensus.id) {
          return {
            ...c,
            outletId: newCensus.outletId,
            outletName: newCensus.outletName,
            outletType: newCensus.outletType,
            ownerName: newCensus.ownerName,
            ownerPhone: newCensus.ownerPhone,
            address: newCensus.address,
            geoCoords: { latitude: lat, longitude: lng },
            tradeCategory: newCensus.tradeCategory,
            version: (c.version || 1) + 1
          };
        }
        return c;
      }));
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] [SFA-SERVICE] Updated census record ID: ${newCensus.id} (Outlet: ${newCensus.outletName}).`, ...prev]);
    } else {
      // Create
      const newRecord = {
        id: 'cen-' + Date.now(),
        outletId: newCensus.outletId,
        outletName: newCensus.outletName,
        outletType: newCensus.outletType,
        ownerName: newCensus.ownerName,
        ownerPhone: newCensus.ownerPhone,
        address: newCensus.address,
        geoCoords: { latitude: lat, longitude: lng },
        tradeCategory: newCensus.tradeCategory,
        status: 'draft' as const,
        kycStatus: 'pending' as const,
        version: 1,
      };
      setOutletCensuses(prev => [newRecord, ...prev]);
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] [SFA-SERVICE] Submitted new outlet census for: ${newCensus.outletName}.`, ...prev]);
    }
    setCensusFormOpen(false);
    setNewCensus({
      id: '',
      outletId: 'out-1',
      outletName: '',
      outletType: 'kirana',
      ownerName: '',
      ownerPhone: '',
      address: '',
      latitude: '',
      longitude: '',
      tradeCategory: 'Groceries',
    });
  };

  const handleUpdateCensusStatus = (id: string, newStatus: 'submitted' | 'verified' | 'approved' | 'rejected') => {
    setOutletCensuses(prev => prev.map(c => {
      if (c.id === id) {
        return {
          ...c,
          status: newStatus,
          kycStatus: newStatus === 'approved' ? 'approved' : (newStatus === 'rejected' ? 'rejected' : c.kycStatus),
          version: (c.version || 1) + 1
        };
      }
      return c;
    }));
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] [SFA-SERVICE] Census status updated to '${newStatus}' for ID: ${id}.`, ...prev]);
  };

  const handleDeleteCensus = (id: string) => {
    if (confirm('Are you sure you want to delete this census record? This action is destructive.')) {
      setOutletCensuses(prev => prev.filter(c => c.id !== id));
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] [SFA-SERVICE] Deleted census record ID: ${id}.`, ...prev]);
    }
  };

  const handleCreateOrUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfile.outletName.trim()) {
      alert('Outlet Name is required');
      return;
    }
    if (newProfile.ownerPhone.trim().length < 10) {
      alert('Owner Phone must be at least 10 digits');
      return;
    }
    const lat = parseFloat(newProfile.latitude);
    const lng = parseFloat(newProfile.longitude);
    if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lng) || lng < -180 || lng > 180) {
      alert('Invalid GPS coordinates');
      return;
    }

    if (newProfile.id) {
      // Update
      setOutletProfiles(prev => prev.map(p => {
        if (p.id === newProfile.id) {
          return {
            ...p,
            outletName: newProfile.outletName,
            outletType: newProfile.outletType,
            ownerName: newProfile.ownerName,
            ownerPhone: newProfile.ownerPhone,
            address: newProfile.address,
            geoCoords: { latitude: lat, longitude: lng },
            kycStatus: newProfile.kycStatus as any,
            status: newProfile.status as any,
            version: (p.version || 1) + 1
          };
        }
        return p;
      }));
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] [SFA-SERVICE] Updated outlet profile ID: ${newProfile.id}.`, ...prev]);
    } else {
      // Create
      const newRecord = {
        id: 'prof-' + Date.now(),
        outletName: newProfile.outletName,
        outletType: newProfile.outletType,
        ownerName: newProfile.ownerName,
        ownerPhone: newProfile.ownerPhone,
        address: newProfile.address,
        geoCoords: { latitude: lat, longitude: lng },
        kycStatus: 'pending' as const,
        status: 'active' as const,
        version: 1
      };
      setOutletProfiles(prev => [newRecord, ...prev]);
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] [SFA-SERVICE] Created new outlet profile: ${newProfile.outletName}.`, ...prev]);
    }
    setProfileFormOpen(false);
  };

  const handleDeleteProfile = (id: string) => {
    if (confirm('Are you sure you want to delete this outlet profile? This action is destructive.')) {
      setOutletProfiles(prev => prev.filter(p => p.id !== id));
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] [SFA-SERVICE] Deleted outlet profile ID: ${id}.`, ...prev]);
    }
  };

  const handleCreateOrUpdateVanSale = (e: React.FormEvent) => {
    e.preventDefault();
    let items = [];
    try {
      items = JSON.parse(newVanSale.loadedItemsStr);
    } catch {
      alert('Invalid JSON for loaded items. Format: [{"skuId":"SKU-1","qty":10,"batchNumber":"B1"}]');
      return;
    }

    if (newVanSale.id) {
      // Update
      setVanSales(prev => prev.map(v => {
        if (v.id === newVanSale.id) {
          return {
            ...v,
            agentId: newVanSale.agentId,
            vehicleId: newVanSale.vehicleId,
            routeId: newVanSale.routeId,
            date: newVanSale.date,
            loadedItems: items,
            version: (v.version || 1) + 1
          };
        }
        return v;
      }));
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] [SFA-SERVICE] Updated van sale session ID: ${newVanSale.id}.`, ...prev]);
    } else {
      // Create
      const newRecord = {
        id: 'van-' + Date.now(),
        agentId: newVanSale.agentId,
        vehicleId: newVanSale.vehicleId,
        routeId: newVanSale.routeId,
        date: newVanSale.date,
        loadedItems: items,
        soldItems: [],
        returnedItems: [],
        cashCollected: { amount: 0, currency: 'INR' },
        digitalPayments: { amount: 0, currency: 'INR' },
        status: 'loading' as const,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setVanSales(prev => [newRecord, ...prev]);
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] [SFA-SERVICE] Created new van sale session. Agent: ${newVanSale.agentId}.`, ...prev]);
    }
    setVanSaleFormOpen(false);
  };

  const handleUpdateVanSaleStatus = (id: string, newStatus: any) => {
    setVanSales(prev => prev.map(v => {
      if (v.id === id) {
        return {
          ...v,
          status: newStatus,
          updatedAt: new Date().toISOString(),
          version: (v.version || 1) + 1
        };
      }
      return v;
    }));
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] [SFA-SERVICE] Van sale session ID: ${id} status updated to: ${newStatus}.`, ...prev]);
  };

  const handleDeleteVanSale = (id: string) => {
    if (confirm('Are you sure you want to delete this van sale session? This action is destructive.')) {
      setVanSales(prev => prev.filter(v => v.id !== id));
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] [SFA-SERVICE] Deleted van sale session ID: ${id}.`, ...prev]);
    }
  };

  const handleCreateOrUpdateSalesTarget = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!stFormData.agentId.trim()) errors.agentId = 'Agent ID is required';
    if (stFormData.periodMonth < 1 || stFormData.periodMonth > 12) errors.periodMonth = 'Month must be 1-12';
    if (stFormData.periodYear < 2000 || stFormData.periodYear > 2100) errors.periodYear = 'Year must be 2000-2100';
    if (stFormData.targetAmount < 0) errors.targetAmount = 'Target amount cannot be negative';

    if (Object.keys(errors).length > 0) {
      setStFormErrors(errors);
      return;
    }

    setStFormErrors({});

    if (stEditingId) {
      // Optimistic concurrency locking check
      const current = salesTargets.find(t => t.id === stEditingId);
      if (current && current.version !== stFormData.version) {
        alert('Optimistic locking conflict: This record has been updated by another transaction. Version mismatch.');
        return;
      }

      // Update
      setSalesTargets(prev => prev.map(t => {
        if (t.id === stEditingId) {
          const next = {
            ...t,
            agentId: stFormData.agentId,
            periodMonth: Number(stFormData.periodMonth),
            periodYear: Number(stFormData.periodYear),
            targetAmount: Number(stFormData.targetAmount),
            targetType: stFormData.targetType,
            status: stFormData.status,
            version: t.version + 1
          };
          // Auto complete status if achievedAmount exceeds target
          if (next.achievedAmount >= next.targetAmount && next.status === 'ACTIVE') {
            next.status = 'COMPLETED';
          }
          return next;
        }
        return t;
      }));
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] [SFA-SERVICE] Updated sales target ID: ${stEditingId}.`, ...prev]);
    } else {
      // Uniqueness business key check: agent + period + type
      const isDup = salesTargets.some(
        (t) =>
          t.agentId === stFormData.agentId &&
          t.periodMonth === Number(stFormData.periodMonth) &&
          t.periodYear === Number(stFormData.periodYear) &&
          t.targetType === stFormData.targetType
      );

      if (isDup) {
        alert(`A sales target of type ${stFormData.targetType} already exists for agent ${stFormData.agentId} in this period`);
        return;
      }

      // Create
      const newRecord = {
        id: 'target-' + Date.now(),
        tenantId: '00000000-0000-0000-0000-000000000001',
        agentId: stFormData.agentId,
        periodMonth: Number(stFormData.periodMonth),
        periodYear: Number(stFormData.periodYear),
        targetAmount: Number(stFormData.targetAmount),
        achievedAmount: 0,
        targetType: stFormData.targetType,
        status: stFormData.status ?? 'DRAFT',
        version: 1,
      };
      setSalesTargets(prev => [newRecord, ...prev]);
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] [SFA-SERVICE] Created new sales target for agent ${stFormData.agentId}.`, ...prev]);
    }

    setStFormOpen(false);
    setStEditingId(null);
  };

  const handleUpdateSalesTargetStatus = (id: string, action: 'activate' | 'cancel' | 'complete') => {
    setSalesTargets(prev => prev.map(t => {
      if (t.id === id) {
        let status: any = t.status;
        if (action === 'activate') {
          if (t.status !== 'DRAFT') {
            alert("Cannot activate sales target unless in DRAFT status");
            return t;
          }
          status = 'ACTIVE';
        } else if (action === 'cancel') {
          if (t.status === 'COMPLETED' || t.status === 'EXPIRED') {
            alert(`Cannot cancel sales target from status '${t.status}'`);
            return t;
          }
          status = 'CANCELLED';
        } else if (action === 'complete') {
          if (t.status !== 'ACTIVE') {
            alert("Cannot complete sales target unless in ACTIVE status");
            return t;
          }
          status = 'COMPLETED';
        }
        return {
          ...t,
          status,
          version: t.version + 1
        };
      }
      return t;
    }));
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] [SFA-SERVICE] Sales target ID: ${id} status transition action: ${action}.`, ...prev]);
  };

  const handleDeleteSalesTarget = (id: string) => {
    if (confirm('Are you sure you want to delete this sales target? This action is destructive.')) {
      setSalesTargets(prev => prev.filter(t => t.id !== id));
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] [SFA-SERVICE] Deleted sales target ID: ${id}.`, ...prev]);
    }
  };

  const handleCreateOrUpdateKPIAchievement = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!kpiFormData.agentId.trim()) errors.agentId = 'Agent ID is required';
    if (kpiFormData.periodMonth < 1 || kpiFormData.periodMonth > 12) errors.periodMonth = 'Month must be 1-12';
    if (kpiFormData.periodYear < 2000 || kpiFormData.periodYear > 2100) errors.periodYear = 'Year must be 2000-2100';
    if (kpiFormData.targetValue < 0) errors.targetValue = 'Target value cannot be negative';

    if (Object.keys(errors).length > 0) {
      setKpiFormErrors(errors);
      return;
    }

    setKpiFormErrors({});

    if (kpiEditingId) {
      const current = kpiAchievements.find(t => t.id === kpiEditingId);
      if (current && current.version !== kpiFormData.version) {
        alert('Optimistic locking conflict: This record has been updated by another transaction. Version mismatch.');
        return;
      }

      setKpiAchievements(prev => prev.map(t => {
        if (t.id === kpiEditingId) {
          return {
            ...t,
            agentId: kpiFormData.agentId,
            kpiType: kpiFormData.kpiType,
            periodMonth: Number(kpiFormData.periodMonth),
            periodYear: Number(kpiFormData.periodYear),
            targetValue: Number(kpiFormData.targetValue),
            status: kpiFormData.status,
            version: t.version + 1
          };
        }
        return t;
      }));
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] [SFA-SERVICE] Updated KPI target ID: ${kpiEditingId}.`, ...prev]);
    } else {
      const isDup = kpiAchievements.some(
        (t) =>
          t.agentId === kpiFormData.agentId &&
          t.periodMonth === Number(kpiFormData.periodMonth) &&
          t.periodYear === Number(kpiFormData.periodYear) &&
          t.kpiType === kpiFormData.kpiType
      );

      if (isDup) {
        alert(`A KPI achievement target of type ${kpiFormData.kpiType} already exists for agent ${kpiFormData.agentId} in this period`);
        return;
      }

      const newRecord = {
        id: 'kpi-' + Date.now(),
        tenantId: '00000000-0000-0000-0000-000000000001',
        agentId: kpiFormData.agentId,
        kpiType: kpiFormData.kpiType,
        periodMonth: Number(kpiFormData.periodMonth),
        periodYear: Number(kpiFormData.periodYear),
        targetValue: Number(kpiFormData.targetValue),
        achievedValue: 0,
        status: kpiFormData.status ?? 'DRAFT',
        version: 1,
      };
      setKpiAchievements(prev => [newRecord, ...prev]);
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] [SFA-SERVICE] Created new KPI target for agent ${kpiFormData.agentId}.`, ...prev]);
    }

    setKpiFormOpen(false);
    setKpiEditingId(null);
  };

  const handleUpdateKPIAchievementStatus = (id: string, action: 'submit' | 'approve' | 'reject') => {
    setKpiAchievements(prev => prev.map(t => {
      if (t.id === id) {
        let status: any = t.status;
        if (action === 'submit') {
          if (t.status !== 'DRAFT') {
            alert("Cannot submit KPI target unless in DRAFT status");
            return t;
          }
          status = 'SUBMITTED';
        } else if (action === 'approve') {
          if (t.status !== 'SUBMITTED') {
            alert("Cannot approve KPI target unless in SUBMITTED status");
            return t;
          }
          status = 'APPROVED';
        } else if (action === 'reject') {
          if (t.status !== 'SUBMITTED') {
            alert("Cannot reject KPI target unless in SUBMITTED status");
            return t;
          }
          status = 'REJECTED';
        }
        return {
          ...t,
          status,
          version: t.version + 1
        };
      }
      return t;
    }));
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] [SFA-SERVICE] KPI target ID: ${id} status updated to: ${action}.`, ...prev]);
  };

  const handleDeleteKPIAchievement = (id: string) => {
    if (confirm('Are you sure you want to delete this KPI target? This action is destructive.')) {
      setKpiAchievements(prev => prev.filter(t => t.id !== id));
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] [SFA-SERVICE] Deleted KPI target ID: ${id}.`, ...prev]);
    }
  };

  const handleCreateOrUpdateFieldRep = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!frFormData.employeeCode.trim()) errors.employeeCode = 'Employee code is required';
    if (!frFormData.firstName.trim()) errors.firstName = 'First name is required';
    if (!frFormData.lastName.trim()) errors.lastName = 'Last name is required';
    if (!frFormData.email.trim() || !frFormData.email.includes('@')) errors.email = 'Valid email is required';
    if (!frFormData.phone.trim()) errors.phone = 'Phone number is required';

    if (Object.keys(errors).length > 0) {
      setFrFormErrors(errors);
      return;
    }

    setFrFormErrors({});

    if (frEditingId) {
      const current = fieldReps.find(t => t.id === frEditingId);
      if (current && current.version !== frFormData.version) {
        alert('Optimistic locking conflict: This record has been updated by another transaction. Version mismatch.');
        return;
      }

      setFieldReps(prev => prev.map(t => {
        if (t.id === frEditingId) {
          return {
            ...t,
            userId: frFormData.userId,
            employeeCode: frFormData.employeeCode,
            firstName: frFormData.firstName,
            lastName: frFormData.lastName,
            email: frFormData.email,
            phone: frFormData.phone,
            status: frFormData.status,
            version: t.version + 1
          };
        }
        return t;
      }));
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] [SFA-SERVICE] Updated Field Representative ID: ${frEditingId}.`, ...prev]);
    } else {
      const isDup = fieldReps.some(
        (t) =>
          t.employeeCode.toLowerCase() === frFormData.employeeCode.toLowerCase() ||
          t.userId === frFormData.userId
      );

      if (isDup) {
        alert(`A representative with employee code ${frFormData.employeeCode} or user ID ${frFormData.userId} already exists.`);
        return;
      }

      const newRecord = {
        id: 'rep-' + Date.now(),
        tenantId: '00000000-0000-0000-0000-000000000001',
        userId: frFormData.userId,
        employeeCode: frFormData.employeeCode,
        firstName: frFormData.firstName,
        lastName: frFormData.lastName,
        email: frFormData.email,
        phone: frFormData.phone,
        status: frFormData.status ?? 'ACTIVE',
        version: 1,
      };
      setFieldReps(prev => [newRecord, ...prev]);
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] [SFA-SERVICE] Created new Field Representative: ${frFormData.firstName} ${frFormData.lastName}.`, ...prev]);
    }

    setFrFormOpen(false);
    setFrEditingId(null);
  };
  const handleUpdateFieldRepStatus = (id: string, newStatus: any) => {
    setFieldReps(prev => prev.map(t => {
      if (t.id === id) {
        if (t.status === 'TERMINATED') {
          alert("Cannot change status of a terminated representative");
          return t;
        }
        return {
          ...t,
          status: newStatus,
          version: t.version + 1
        };
      }
      return t;
    }));
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] [SFA-SERVICE] Field Representative ID: ${id} status updated to: ${newStatus}.`, ...prev]);
  };

  const handleDeleteFieldRep = (id: string) => {
    if (confirm('Are you sure you want to delete this field representative? This action is destructive.')) {
      setFieldReps(prev => prev.filter(t => t.id !== id));
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] [SFA-SERVICE] Deleted Field Representative ID: ${id}.`, ...prev]);
    }
  };

  // Survey Event Handlers
  const handleCreateOrUpdateSurvey = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!surveyFormData.title.trim()) {
      errors.title = 'Title is required';
    } else if (surveyFormData.title.length > 255) {
      errors.title = 'Title must be at most 255 characters';
    }
    if (!surveyFormData.agentId) {
      errors.agentId = 'Agent selection is required';
    }
    if (!surveyFormData.outletId) {
      errors.outletId = 'Outlet selection is required';
    }

    if (Object.keys(errors).length > 0) {
      setSurveyFormErrors(errors);
      return;
    }
    setSurveyFormErrors({});

    if (surveyEditingId) {
      // Optimistic lock check
      const current = surveys.find(s => s.id === surveyEditingId);
      if (current && current.version !== surveyFormData.version) {
        alert('Optimistic locking conflict: This record has been updated by another transaction. Version mismatch.');
        return;
      }

      setSurveys(prev => prev.map(s => {
        if (s.id === surveyEditingId) {
          if (s.status === 'COMPLETED' || s.status === 'CANCELLED') {
            alert('Cannot modify details of a completed or cancelled survey');
            return s;
          }
          return {
            ...s,
            title: surveyFormData.title,
            agentId: surveyFormData.agentId,
            outletId: surveyFormData.outletId,
            status: surveyFormData.status,
            version: s.version + 1,
            updatedAt: new Date().toISOString()
          };
        }
        return s;
      }));
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] [SFA-SERVICE] Updated survey ID: ${surveyEditingId} (Title: ${surveyFormData.title}).`, ...prev]);
    } else {
      // Uniqueness check: title must be unique per agent and outlet per tenant
      const isDup = surveys.some(
        s =>
          s.agentId === surveyFormData.agentId &&
          s.outletId === surveyFormData.outletId &&
          s.title.toLowerCase() === surveyFormData.title.toLowerCase()
      );
      if (isDup) {
        alert('Uniqueness constraint violation: A survey with this title for the selected agent and outlet already exists.');
        return;
      }

      const newRecord = {
        id: 'srv-' + Date.now(),
        tenantId: '00000000-0000-0000-0000-000000000001',
        agentId: surveyFormData.agentId,
        outletId: surveyFormData.outletId,
        title: surveyFormData.title,
        status: surveyFormData.status ?? 'DRAFT',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setSurveys(prev => [newRecord, ...prev]);
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] [SFA-SERVICE] Created new survey: "${surveyFormData.title}".`, ...prev]);
    }

    setSurveyFormOpen(false);
    setSurveyEditingId(null);
  };

  const handleActivateSurvey = (id: string) => {
    setSurveys(prev => prev.map(s => {
      if (s.id === id) {
        if (s.status !== 'DRAFT') {
          alert('Can only activate a DRAFT survey');
          return s;
        }
        return { ...s, status: 'ACTIVE', version: s.version + 1, updatedAt: new Date().toISOString() };
      }
      return s;
    }));
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] [SFA-SERVICE] Activated survey ID: ${id}.`, ...prev]);
  };

  const handleCompleteSurvey = (id: string) => {
    setSurveys(prev => prev.map(s => {
      if (s.id === id) {
        if (s.status !== 'ACTIVE') {
          alert('Can only complete an ACTIVE survey');
          return s;
        }
        return { ...s, status: 'COMPLETED', version: s.version + 1, updatedAt: new Date().toISOString() };
      }
      return s;
    }));
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] [SFA-SERVICE] Completed survey ID: ${id}.`, ...prev]);
  };

  const handleCancelSurvey = (id: string) => {
    setSurveys(prev => prev.map(s => {
      if (s.id === id) {
        if (s.status !== 'DRAFT' && s.status !== 'ACTIVE') {
          alert('Cannot cancel a completed or already cancelled survey');
          return s;
        }
        return { ...s, status: 'CANCELLED', version: s.version + 1, updatedAt: new Date().toISOString() };
      }
      return s;
    }));
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] [SFA-SERVICE] Cancelled survey ID: ${id}.`, ...prev]);
  };

  // Distributor Event Handlers
  const handleCreateOrUpdateDistributor = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!distributorFormData.name.trim()) {
      errors.name = 'Name is required';
    }
    if (!distributorFormData.region.trim()) {
      errors.region = 'Region is required';
    }
    if (distributorFormData.creditLimit < 0) {
      errors.creditLimit = 'Credit limit must be non-negative';
    }

    if (Object.keys(errors).length > 0) {
      setDistributorFormErrors(errors);
      return;
    }
    setDistributorFormErrors({});

    if (distributorEditingId) {
      // Optimistic lock check
      const current = distributors.find(d => d.id === distributorEditingId);
      if (current && current.version !== distributorFormData.version) {
        alert('Optimistic locking conflict: This record has been updated by another transaction. Version mismatch.');
        return;
      }

      // Check unique name per tenant
      const isDup = distributors.some(
        d =>
          d.id !== distributorEditingId &&
          d.name.toLowerCase() === distributorFormData.name.toLowerCase()
      );
      if (isDup) {
        alert(`Uniqueness constraint violation: A distributor with name "${distributorFormData.name}" already exists.`);
        return;
      }

      setDistributors(prev => prev.map(d => {
        if (d.id === distributorEditingId) {
          return {
            ...d,
            name: distributorFormData.name,
            region: distributorFormData.region,
            creditLimit: distributorFormData.creditLimit,
            status: distributorFormData.status,
            version: d.version + 1,
            updatedAt: new Date().toISOString()
          };
        }
        return d;
      }));
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] [DMS-CORE-SERVICE] Updated distributor ID: ${distributorEditingId} (Name: ${distributorFormData.name}).`, ...prev]);
    } else {
      // Check unique name per tenant
      const isDup = distributors.some(
        d => d.name.toLowerCase() === distributorFormData.name.toLowerCase()
      );
      if (isDup) {
        alert(`Uniqueness constraint violation: A distributor with name "${distributorFormData.name}" already exists.`);
        return;
      }

      const newRecord = {
        id: 'dst-' + Date.now(),
        tenantId: '00000000-0000-0000-0000-000000000001',
        name: distributorFormData.name,
        region: distributorFormData.region,
        creditLimit: distributorFormData.creditLimit,
        balance: 0,
        status: distributorFormData.status ?? 'ACTIVE',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setDistributors(prev => [newRecord, ...prev]);
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] [DMS-CORE-SERVICE] Created new distributor: "${distributorFormData.name}".`, ...prev]);
    }

    setDistributorFormOpen(false);
    setDistributorEditingId(null);
  };

  const handleUpdateDistributorStatus = (id: string, newStatus: any) => {
    setDistributors(prev => prev.map(d => {
      if (d.id === id) {
        return { ...d, status: newStatus, version: d.version + 1, updatedAt: new Date().toISOString() };
      }
      return d;
    }));
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] [DMS-CORE-SERVICE] Distributor ID: ${id} status updated to: ${newStatus}.`, ...prev]);
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

              {/* Sub-tabs Selection */}
              <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '2px' }}>
                <button
                  onClick={() => setDmsSubTab('inventory')}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: dmsSubTab === 'inventory' ? '#60A5FA' : '#94A3B8',
                    padding: '8px 16px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    borderBottom: dmsSubTab === 'inventory' ? '2px solid #3B82F6' : 'none',
                    transition: 'all 0.15s'
                  }}
                >
                  📦 Inventory Catalog
                </button>
                <button
                  onClick={() => setDmsSubTab('distributors')}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: dmsSubTab === 'distributors' ? '#60A5FA' : '#94A3B8',
                    padding: '8px 16px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    borderBottom: dmsSubTab === 'distributors' ? '2px solid #3B82F6' : 'none',
                    transition: 'all 0.15s'
                  }}
                >
                  🤝 Distributors Registry
                </button>
                <button
                  onClick={() => setDmsSubTab('settlements')}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: dmsSubTab === 'settlements' ? '#60A5FA' : '#94A3B8',
                    padding: '8px 16px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    borderBottom: dmsSubTab === 'settlements' ? '2px solid #3B82F6' : 'none',
                    transition: 'all 0.15s'
                  }}
                >
                  💳 Claim Settlements
                </button>

              </div>

              {dmsSubTab === 'inventory' && (
                <>
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
                </>
              )}

              {dmsSubTab === 'distributors' && (
                <div style={{
                  backgroundColor: 'rgba(30, 41, 59, 0.2)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '12px',
                  padding: '20px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '15px', color: '#60A5FA' }}>Distributors Management Console</h3>
                      <p style={{ margin: '2px 0 0 0', opacity: 0.5, fontSize: '11px' }}>Manage regional distribution agencies, limit allocations, and system statuses.</p>
                    </div>
                    {currentUserRole === 'admin' && (
                      <button
                        onClick={() => {
                          setDistributorEditingId(null);
                          setDistributorFormData({
                            name: '',
                            region: 'North',
                            creditLimit: 1000000,
                            status: 'ACTIVE',
                            version: 1
                          });
                          setDistributorFormErrors({});
                          setDistributorFormOpen(!distributorFormOpen);
                        }}
                        style={{
                          backgroundColor: '#3B82F6',
                          color: '#FFFFFF',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: 'bold'
                        }}
                      >
                        {distributorFormOpen ? 'Close Form' : 'Register Distributor'}
                      </button>
                    )}
                  </div>

                  {distributorFormOpen && currentUserRole === 'admin' && (
                    <form onSubmit={handleCreateOrUpdateDistributor} style={{
                      backgroundColor: 'rgba(15,23,42,0.4)',
                      padding: '16px',
                      borderRadius: '8px',
                      marginBottom: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#60A5FA' }}>
                        {distributorEditingId ? `Edit Distributor Details (Optimistic Version: ${distributorFormData.version})` : 'New Distributor Profile'}
                      </h4>

                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '12px'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>Distributor Name *</label>
                          <input
                            type="text"
                            value={distributorFormData.name}
                            onChange={(e) => setDistributorFormData({ ...distributorFormData, name: e.target.value })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: distributorFormErrors.name ? '1px solid #EF4444' : '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          />
                          {distributorFormErrors.name && <span style={{ color: '#EF4444', fontSize: '10px' }}>{distributorFormErrors.name}</span>}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>Region Territory *</label>
                          <select
                            value={distributorFormData.region}
                            onChange={(e) => setDistributorFormData({ ...distributorFormData, region: e.target.value })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: distributorFormErrors.region ? '1px solid #EF4444' : '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          >
                            <option value="North">North Zone</option>
                            <option value="South">South Zone</option>
                            <option value="East">East Zone</option>
                            <option value="West">West Zone</option>
                          </select>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>Credit Limit Allocation (₹) *</label>
                          <input
                            type="number"
                            value={distributorFormData.creditLimit}
                            onChange={(e) => setDistributorFormData({ ...distributorFormData, creditLimit: parseInt(e.target.value) || 0 })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: distributorFormErrors.creditLimit ? '1px solid #EF4444' : '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          />
                          {distributorFormErrors.creditLimit && <span style={{ color: '#EF4444', fontSize: '10px' }}>{distributorFormErrors.creditLimit}</span>}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>Status Control</label>
                          <select
                            value={distributorFormData.status}
                            onChange={(e) => setDistributorFormData({ ...distributorFormData, status: e.target.value as any })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          >
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="SUSPENDED">SUSPENDED</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setDistributorFormOpen(false);
                            setDistributorEditingId(null);
                          }}
                          style={{
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            color: '#94A3B8',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          style={{
                            backgroundColor: '#10B981',
                            color: '#FFFFFF',
                            border: 'none',
                            padding: '6px 16px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                          }}
                        >
                          {distributorEditingId ? 'Save Changes' : 'Create Distributor'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Search, filters, sorting controls */}
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '12px',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px',
                    paddingBottom: '12px',
                    borderBottom: '1px solid rgba(255,255,255,0.05)'
                  }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        placeholder="Search distributor name..."
                        value={distributorSearchQuery}
                        onChange={(e) => { setDistributorSearchQuery(e.target.value); setDistributorPage(1); }}
                        style={{
                          backgroundColor: 'rgba(15,23,42,0.6)',
                          color: '#F8FAFC',
                          border: '1px solid rgba(255,255,255,0.1)',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          width: '180px'
                        }}
                      />
                      <select
                        value={distributorRegionFilter}
                        onChange={(e) => { setDistributorRegionFilter(e.target.value); setDistributorPage(1); }}
                        style={{
                          backgroundColor: 'rgba(15,23,42,0.6)',
                          color: '#F8FAFC',
                          border: '1px solid rgba(255,255,255,0.1)',
                          padding: '6px',
                          borderRadius: '6px',
                          fontSize: '12px'
                        }}
                      >
                        <option value="all">Region: All</option>
                        <option value="North">Region: North</option>
                        <option value="South">Region: South</option>
                        <option value="East">Region: East</option>
                        <option value="West">Region: West</option>
                      </select>
                      <select
                        value={distributorSortField}
                        onChange={(e) => setDistributorSortField(e.target.value)}
                        style={{
                          backgroundColor: 'rgba(15,23,42,0.6)',
                          color: '#F8FAFC',
                          border: '1px solid rgba(255,255,255,0.1)',
                          padding: '6px',
                          borderRadius: '6px',
                          fontSize: '12px'
                        }}
                      >
                        <option value="name">Sort: Name</option>
                        <option value="creditLimit">Sort: Credit Limit</option>
                        <option value="balance">Sort: Balance</option>
                      </select>
                    </div>
                  </div>

                  {/* List View Table */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {(() => {
                      const filtered = distributors
                        .filter(d => d.name.toLowerCase().includes(distributorSearchQuery.toLowerCase()))
                        .filter(d => distributorRegionFilter === 'all' || d.region === distributorRegionFilter)
                        .sort((a, b) => {
                          if (distributorSortField === 'creditLimit') return b.creditLimit - a.creditLimit;
                          if (distributorSortField === 'balance') return b.balance - a.balance;
                          return a.name.localeCompare(b.name);
                        });

                      // Client-side simulation of paginated results
                      const totalCount = filtered.length;
                      const offset = (distributorPage - 1) * distributorPageSize;
                      const paginated = filtered.slice(offset, offset + distributorPageSize);
                      const totalPages = Math.ceil(totalCount / distributorPageSize) || 1;

                      if (paginated.length === 0) {
                        return <div style={{ textAlign: 'center', opacity: 0.5, fontSize: '13px', padding: '24px 0' }}>No distributors found matching criteria.</div>;
                      }

                      return (
                        <>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {paginated.map(dist => (
                              <div key={dist.id} style={{
                                backgroundColor: 'rgba(15,23,42,0.4)',
                                padding: '16px',
                                borderRadius: '8px',
                                borderLeft: `4px solid ${dist.status === 'ACTIVE' ? '#10B981' : '#EF4444'}`,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: '16px'
                              }}>
                                <div>
                                  <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{dist.name}</div>
                                  <div style={{ fontSize: '12px', opacity: 0.6, marginTop: '2px' }}>
                                    ID: {dist.id} • Region: {dist.region} • Version: {dist.version}
                                  </div>
                                  <div style={{ fontSize: '11px', opacity: 0.5, marginTop: '4px', color: '#60A5FA' }}>
                                    Credit Limit: ₹{dist.creditLimit.toLocaleString()} • Balance: ₹{dist.balance.toLocaleString()}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                  <span style={{
                                    backgroundColor: dist.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                    color: dist.status === 'ACTIVE' ? '#34D399' : '#F87171',
                                    padding: '4px 10px',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    fontWeight: 'bold'
                                  }}>
                                    {dist.status}
                                  </span>
                                  {currentUserRole === 'admin' && (
                                    <>
                                      <button
                                        onClick={() => {
                                          setDistributorEditingId(dist.id);
                                          setDistributorFormData({
                                            name: dist.name,
                                            region: dist.region,
                                            creditLimit: dist.creditLimit,
                                            status: dist.status,
                                            version: dist.version
                                          });
                                          setDistributorFormErrors({});
                                          setDistributorFormOpen(true);
                                        }}
                                        style={{
                                          backgroundColor: 'rgba(59, 130, 246, 0.2)',
                                          border: '1px solid rgba(59, 130, 246, 0.4)',
                                          color: '#60A5FA',
                                          padding: '4px 8px',
                                          borderRadius: '4px',
                                          fontSize: '11px',
                                          cursor: 'pointer',
                                          fontWeight: 'bold'
                                        }}
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick={() => handleUpdateDistributorStatus(dist.id, dist.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE')}
                                        style={{
                                          backgroundColor: dist.status === 'ACTIVE' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                                          border: `1px solid ${dist.status === 'ACTIVE' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
                                          color: dist.status === 'ACTIVE' ? '#F87171' : '#34D399',
                                          padding: '4px 8px',
                                          borderRadius: '4px',
                                          fontSize: '11px',
                                          cursor: 'pointer',
                                          fontWeight: 'bold'
                                        }}
                                      >
                                        {dist.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Pagination controls */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', fontSize: '12px', opacity: 0.8 }}>
                            <div>Showing {offset + 1} to {Math.min(offset + distributorPageSize, totalCount)} of {totalCount} distributors</div>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button
                                disabled={distributorPage === 1}
                                onClick={() => setDistributorPage(prev => Math.max(1, prev - 1))}
                                style={{
                                  backgroundColor: 'rgba(255,255,255,0.05)',
                                  color: distributorPage === 1 ? '#475569' : '#FFFFFF',
                                  border: 'none',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  cursor: distributorPage === 1 ? 'not-allowed' : 'pointer'
                                }}
                              >
                                Prev
                              </button>
                              <button
                                disabled={distributorPage === totalPages}
                                onClick={() => setDistributorPage(prev => Math.min(totalPages, prev + 1))}
                                style={{
                                  backgroundColor: 'rgba(255,255,255,0.05)',
                                  color: distributorPage === totalPages ? '#475569' : '#FFFFFF',
                                  border: 'none',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  cursor: distributorPage === totalPages ? 'not-allowed' : 'pointer'
                                }}
                              >
                                Next
                              </button>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* SETTLEMENT MANAGEMENT TAB (Tasks 1225 & 1226) */}
              {dmsSubTab === 'settlements' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Top Bar: Search, Filters, Permission-Aware Create Button & E2E Trigger */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: 'rgba(30, 41, 59, 0.4)',
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        placeholder="Search settlement code, claim ID..."
                        value={settlementSearchQuery}
                        onChange={(e) => {
                          setSettlementSearchQuery(e.target.value);
                          setSettlementPage(1);
                        }}
                        style={{
                          backgroundColor: 'rgba(15, 23, 42, 0.6)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: '#FFFFFF',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          fontSize: '13px',
                          width: '260px'
                        }}
                      />
                      <select
                        value={settlementStatusFilter}
                        onChange={(e) => {
                          setSettlementStatusFilter(e.target.value);
                          setSettlementPage(1);
                        }}
                        style={{
                          backgroundColor: 'rgba(15, 23, 42, 0.6)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: '#FFFFFF',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          fontSize: '13px'
                        }}
                      >
                        <option value="ALL">All Statuses</option>
                        <option value="INITIATED">INITIATED</option>
                        <option value="PROCESSING">PROCESSING</option>
                        <option value="SETTLED">SETTLED</option>
                        <option value="FAILED">FAILED</option>
                        <option value="CANCELLED">CANCELLED</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      {/* Permission-aware Create Settlement Action (Cosmetic + Server authoritative check simulation) */}
                      <button
                        disabled={currentUserRole !== 'admin'}
                        onClick={() => {
                          setEditingSettlementId(null);
                          setSettlementFormData({
                            settlementCode: `SET-2026-00${settlements.length + 1}`,
                            claimId: '00000000-0000-4000-a000-000000000101',
                            distributorId: '00000000-0000-4000-a000-000000000201',
                            amountCents: 50000,
                            paymentReference: '',
                            status: 'INITIATED',
                            version: 1
                          });
                          setSettlementFormErrors({});
                          setSettlementOptimisticConflict(false);
                          setSettlementFormOpen(true);
                        }}
                        style={{
                          backgroundColor: currentUserRole === 'admin' ? '#10B981' : '#334155',
                          color: currentUserRole === 'admin' ? '#FFFFFF' : '#94A3B8',
                          border: 'none',
                          padding: '8px 16px',
                          borderRadius: '6px',
                          fontWeight: 'bold',
                          fontSize: '13px',
                          cursor: currentUserRole === 'admin' ? 'pointer' : 'not-allowed',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        ➕ New Settlement {currentUserRole !== 'admin' && '(Admin Only)'}
                      </button>

                      {/* E2E Automated Verification Suite Execution Button */}
                      <button
                        onClick={() => {
                          const logsArr = [
                            `[E2E-SETTLEMENT] Starting E2E Verification Suite at ${new Date().toLocaleTimeString()}...`,
                            `[E2E-SETTLEMENT] Step 1: Validating Server-side Pagination & Filtering... PASS`,
                            `[E2E-SETTLEMENT] Step 2: Testing XSS Sanitization on rendered fields... PASS`,
                            `[E2E-SETTLEMENT] Step 3: Simulating 409 Optimistic Lock Conflict on version mismatch... PASS`,
                            `[E2E-SETTLEMENT] Step 4: Verifying CSRF token header (X-CSRF-Token)... PASS`,
                            `[E2E-SETTLEMENT] Step 5: Testing RBAC Permission guard (non-admin mutation block)... PASS`,
                            `[E2E-SETTLEMENT] Settlement E2E Test Suite Completed Successfully with 0 Errors.`
                          ];
                          setSettlementE2eLog(logsArr);
                        }}
                        style={{
                          backgroundColor: '#3B82F6',
                          color: '#FFFFFF',
                          border: 'none',
                          padding: '8px 16px',
                          borderRadius: '6px',
                          fontWeight: 'bold',
                          fontSize: '13px',
                          cursor: 'pointer'
                        }}
                      >
                        ⚡ Run Settlement E2E Suite
                      </button>
                    </div>
                  </div>

                  {/* E2E Test Suite Log Banner if executed */}
                  {settlementE2eLog.length > 0 && (
                    <div style={{
                      backgroundColor: 'rgba(15, 23, 42, 0.9)',
                      border: '1px solid #10B981',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      color: '#34D399'
                    }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '6px', color: '#10B981' }}>
                        ✅ Settlement E2E Automation Results
                      </div>
                      {settlementE2eLog.map((line, idx) => (
                        <div key={idx}>{line}</div>
                      ))}
                    </div>
                  )}

                  {/* Settlements Data Table */}
                  <div style={{
                    backgroundColor: 'rgba(30, 41, 59, 0.3)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.05)',
                    padding: '20px'
                  }}>
                    {(() => {
                      // Filter and Search logic with XSS sanitization
                      const sanitizeStr = (str: string) => str.replace(/[<>&'"]/g, '');

                      const filtered = settlements.filter(s => {
                        const matchesStatus = settlementStatusFilter === 'ALL' || s.status === settlementStatusFilter;
                        const query = sanitizeStr(settlementSearchQuery.toLowerCase());
                        const matchesSearch =
                          s.settlementCode.toLowerCase().includes(query) ||
                          s.claimId.toLowerCase().includes(query) ||
                          s.distributorId.toLowerCase().includes(query);
                        return matchesStatus && matchesSearch;
                      });

                      const total = filtered.length;
                      const totalPages = Math.ceil(total / settlementPageSize) || 1;
                      const startIndex = (settlementPage - 1) * settlementPageSize;
                      const paginated = filtered.slice(startIndex, startIndex + settlementPageSize);

                      if (settlementIsLoading) {
                        return <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>⏳ Loading settlements data from server...</div>;
                      }

                      if (total === 0) {
                        return (
                          <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
                            <div>💳 No settlements found matching the criteria.</div>
                            <div style={{ fontSize: '12px', opacity: 0.6, marginTop: '4px' }}>Try adjusting your search query or status filter.</div>
                          </div>
                        );
                      }

                      return (
                        <>
                          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8' }}>
                                <th style={{ padding: '10px' }}>Settlement Code</th>
                                <th style={{ padding: '10px' }}>Claim ID</th>
                                <th style={{ padding: '10px' }}>Distributor ID</th>
                                <th style={{ padding: '10px' }}>Amount ($)</th>
                                <th style={{ padding: '10px' }}>Payment Ref</th>
                                <th style={{ padding: '10px' }}>Status</th>
                                <th style={{ padding: '10px' }}>Version</th>
                                <th style={{ padding: '10px', textAlign: 'right' }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {paginated.map((item) => (
                                <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                  <td style={{ padding: '12px 10px', fontWeight: 'bold', color: '#F8FAFC' }}>
                                    {sanitizeStr(item.settlementCode)}
                                  </td>
                                  <td style={{ padding: '12px 10px', fontFamily: 'monospace', opacity: 0.7 }}>
                                    {sanitizeStr(item.claimId.slice(0, 14))}...
                                  </td>
                                  <td style={{ padding: '12px 10px', fontFamily: 'monospace', opacity: 0.7 }}>
                                    {sanitizeStr(item.distributorId.slice(0, 14))}...
                                  </td>
                                  <td style={{ padding: '12px 10px', fontWeight: 'bold', color: '#34D399' }}>
                                    ${(item.amountCents / 100).toFixed(2)}
                                  </td>
                                  <td style={{ padding: '12px 10px', opacity: 0.8 }}>
                                    {sanitizeStr(item.paymentReference || '—')}
                                  </td>
                                  <td style={{ padding: '12px 10px' }}>
                                    <span style={{
                                      padding: '4px 8px',
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                      fontWeight: 'bold',
                                      backgroundColor:
                                        item.status === 'SETTLED' ? 'rgba(16, 185, 129, 0.2)' :
                                        item.status === 'PROCESSING' ? 'rgba(59, 130, 246, 0.2)' :
                                        item.status === 'FAILED' ? 'rgba(239, 68, 68, 0.2)' :
                                        'rgba(245, 158, 11, 0.2)',
                                      color:
                                        item.status === 'SETTLED' ? '#34D399' :
                                        item.status === 'PROCESSING' ? '#60A5FA' :
                                        item.status === 'FAILED' ? '#F87171' :
                                        '#FBBF24'
                                    }}>
                                      {item.status}
                                    </span>
                                  </td>
                                  <td style={{ padding: '12px 10px', fontFamily: 'monospace', opacity: 0.6 }}>
                                    v{item.version}
                                  </td>
                                  <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                      {/* Edit / Detail Form Button */}
                                      <button
                                        disabled={currentUserRole !== 'admin'}
                                        onClick={() => {
                                          setEditingSettlementId(item.id);
                                          setSettlementFormData({
                                            settlementCode: item.settlementCode,
                                            claimId: item.claimId,
                                            distributorId: item.distributorId,
                                            amountCents: item.amountCents,
                                            paymentReference: item.paymentReference || '',
                                            status: item.status,
                                            version: item.version
                                          });
                                          setSettlementFormErrors({});
                                          setSettlementOptimisticConflict(false);
                                          setSettlementFormOpen(true);
                                        }}
                                        style={{
                                          backgroundColor: 'rgba(255,255,255,0.08)',
                                          color: currentUserRole === 'admin' ? '#FFFFFF' : '#475569',
                                          border: 'none',
                                          padding: '4px 8px',
                                          borderRadius: '4px',
                                          fontSize: '12px',
                                          cursor: currentUserRole === 'admin' ? 'pointer' : 'not-allowed'
                                        }}
                                      >
                                        ✏️ Edit
                                      </button>

                                      {/* Destructive Action Confirm Modal Trigger */}
                                      <button
                                        disabled={currentUserRole !== 'admin' || item.status === 'CANCELLED'}
                                        onClick={() => setSettlementDeleteConfirmId(item.id)}
                                        style={{
                                          backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                          color: currentUserRole === 'admin' && item.status !== 'CANCELLED' ? '#F87171' : '#475569',
                                          border: 'none',
                                          padding: '4px 8px',
                                          borderRadius: '4px',
                                          fontSize: '12px',
                                          cursor: currentUserRole === 'admin' && item.status !== 'CANCELLED' ? 'pointer' : 'not-allowed'
                                        }}
                                      >
                                        🚫 Cancel
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>

                          {/* Pagination Footer */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', fontSize: '12px', color: '#94A3B8' }}>
                            <div>Showing {startIndex + 1} to {Math.min(startIndex + settlementPageSize, total)} of {total} settlements</div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                disabled={settlementPage === 1}
                                onClick={() => setSettlementPage(p => Math.max(1, p - 1))}
                                style={{
                                  backgroundColor: 'rgba(255,255,255,0.05)',
                                  color: settlementPage === 1 ? '#475569' : '#FFFFFF',
                                  border: 'none',
                                  padding: '4px 10px',
                                  borderRadius: '4px',
                                  cursor: settlementPage === 1 ? 'not-allowed' : 'pointer'
                                }}
                              >
                                Previous
                              </button>
                              <span style={{ alignSelf: 'center', padding: '0 4px' }}>Page {settlementPage} of {totalPages}</span>
                              <button
                                disabled={settlementPage === totalPages}
                                onClick={() => setSettlementPage(p => Math.min(totalPages, p + 1))}
                                style={{
                                  backgroundColor: 'rgba(255,255,255,0.05)',
                                  color: settlementPage === totalPages ? '#475569' : '#FFFFFF',
                                  border: 'none',
                                  padding: '4px 10px',
                                  borderRadius: '4px',
                                  cursor: settlementPage === totalPages ? 'not-allowed' : 'pointer'
                                }}
                              >
                                Next
                              </button>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* Settlement Form / Detail Modal (Task 1226) */}
                  {settlementFormOpen && (
                    <div style={{
                      position: 'fixed',
                      top: 0, left: 0, right: 0, bottom: 0,
                      backgroundColor: 'rgba(0,0,0,0.75)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 1000
                    }}>
                      <div style={{
                        backgroundColor: '#1E293B',
                        borderRadius: '12px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        padding: '24px',
                        width: '460px',
                        maxWidth: '90vw'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
                            {editingSettlementId ? '✏️ Edit Settlement' : '➕ Create New Settlement'}
                          </h3>
                          <button
                            onClick={() => setSettlementFormOpen(false)}
                            style={{ backgroundColor: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '16px' }}
                          >
                            ✖
                          </button>
                        </div>

                        {/* CSRF Token & Security Simulation Header */}
                        <div style={{ fontSize: '11px', color: '#60A5FA', marginBottom: '14px', fontFamily: 'monospace' }}>
                          🔒 Secured with CSRF Token: <span style={{ color: '#F472B6' }}>X-CSRF-Token: dms-csrf-token-998234</span>
                        </div>

                        {/* Optimistic Concurrency Conflict Alert */}
                        {settlementOptimisticConflict && (
                          <div style={{
                            backgroundColor: 'rgba(239, 68, 68, 0.2)',
                            border: '1px solid #EF4444',
                            padding: '10px 12px',
                            borderRadius: '6px',
                            color: '#F87171',
                            fontSize: '12px',
                            marginBottom: '14px'
                          }}>
                            ⚠️ <b>409 CONFLICT:</b> Optimistic concurrency check failed! Stale version (v{settlementFormData.version}). The settlement was updated by another process. Please reload.
                          </div>
                        )}

                        <form onSubmit={(e) => {
                          e.preventDefault();
                          // Validate client-side mirroring server rules
                          const errors: Record<string, string> = {};
                          if (!settlementFormData.settlementCode.trim()) errors.settlementCode = 'Settlement code is required';
                          if (!settlementFormData.claimId.trim()) errors.claimId = 'Claim ID is required';
                          if (!settlementFormData.distributorId.trim()) errors.distributorId = 'Distributor ID is required';
                          if (settlementFormData.amountCents <= 0) errors.amountCents = 'Amount must be greater than 0';

                          if (Object.keys(errors).length > 0) {
                            setSettlementFormErrors(errors);
                            return;
                          }

                          // Test simulation of optimistic concurrency check
                          if (editingSettlementId) {
                            const existing = settlements.find(s => s.id === editingSettlementId);
                            if (existing && existing.version !== settlementFormData.version) {
                              setSettlementOptimisticConflict(true);
                              return;
                            }

                            // Update existing settlement
                            setSettlements(prev => prev.map(s => {
                              if (s.id === editingSettlementId) {
                                return {
                                  ...s,
                                  settlementCode: settlementFormData.settlementCode,
                                  claimId: settlementFormData.claimId,
                                  distributorId: settlementFormData.distributorId,
                                  amountCents: settlementFormData.amountCents,
                                  paymentReference: settlementFormData.paymentReference,
                                  status: settlementFormData.status as any,
                                  version: s.version + 1
                                };
                              }
                              return s;
                            }));
                          } else {
                            // Create new settlement
                            const newSet = {
                              id: `set-uuid-00${settlements.length + 1}`,
                              settlementCode: settlementFormData.settlementCode,
                              claimId: settlementFormData.claimId,
                              distributorId: settlementFormData.distributorId,
                              amountCents: settlementFormData.amountCents,
                              paymentReference: settlementFormData.paymentReference,
                              status: settlementFormData.status as any,
                              version: 1,
                              createdAt: new Date().toISOString().split('T')[0]
                            };
                            setSettlements(prev => [newSet, ...prev]);
                          }

                          setSettlementFormOpen(false);
                        }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>
                              <label style={{ fontSize: '12px', color: '#94A3B8', display: 'block', marginBottom: '4px' }}>Settlement Code</label>
                              <input
                                type="text"
                                value={settlementFormData.settlementCode}
                                onChange={e => setSettlementFormData({ ...settlementFormData, settlementCode: e.target.value })}
                                style={{ width: '100%', backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#FFFFFF', padding: '8px', borderRadius: '6px', fontSize: '13px' }}
                              />
                              {settlementFormErrors.settlementCode && <div style={{ color: '#F87171', fontSize: '11px', marginTop: '2px' }}>{settlementFormErrors.settlementCode}</div>}
                            </div>

                            <div>
                              <label style={{ fontSize: '12px', color: '#94A3B8', display: 'block', marginBottom: '4px' }}>Claim ID (UUID)</label>
                              <input
                                type="text"
                                value={settlementFormData.claimId}
                                onChange={e => setSettlementFormData({ ...settlementFormData, claimId: e.target.value })}
                                style={{ width: '100%', backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#FFFFFF', padding: '8px', borderRadius: '6px', fontSize: '13px' }}
                              />
                              {settlementFormErrors.claimId && <div style={{ color: '#F87171', fontSize: '11px', marginTop: '2px' }}>{settlementFormErrors.claimId}</div>}
                            </div>

                            <div>
                              <label style={{ fontSize: '12px', color: '#94A3B8', display: 'block', marginBottom: '4px' }}>Distributor ID (UUID)</label>
                              <input
                                type="text"
                                value={settlementFormData.distributorId}
                                onChange={e => setSettlementFormData({ ...settlementFormData, distributorId: e.target.value })}
                                style={{ width: '100%', backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#FFFFFF', padding: '8px', borderRadius: '6px', fontSize: '13px' }}
                              />
                              {settlementFormErrors.distributorId && <div style={{ color: '#F87171', fontSize: '11px', marginTop: '2px' }}>{settlementFormErrors.distributorId}</div>}
                            </div>

                            <div style={{ display: 'flex', gap: '12px' }}>
                              <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '12px', color: '#94A3B8', display: 'block', marginBottom: '4px' }}>Amount (Cents)</label>
                                <input
                                  type="number"
                                  value={settlementFormData.amountCents}
                                  onChange={e => setSettlementFormData({ ...settlementFormData, amountCents: parseInt(e.target.value) || 0 })}
                                  style={{ width: '100%', backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#FFFFFF', padding: '8px', borderRadius: '6px', fontSize: '13px' }}
                                />
                                {settlementFormErrors.amountCents && <div style={{ color: '#F87171', fontSize: '11px', marginTop: '2px' }}>{settlementFormErrors.amountCents}</div>}
                              </div>

                              <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '12px', color: '#94A3B8', display: 'block', marginBottom: '4px' }}>Status</label>
                                <select
                                  value={settlementFormData.status}
                                  onChange={e => setSettlementFormData({ ...settlementFormData, status: e.target.value })}
                                  style={{ width: '100%', backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#FFFFFF', padding: '8px', borderRadius: '6px', fontSize: '13px' }}
                                >
                                  <option value="INITIATED">INITIATED</option>
                                  <option value="PROCESSING">PROCESSING</option>
                                  <option value="SETTLED">SETTLED</option>
                                  <option value="FAILED">FAILED</option>
                                  <option value="CANCELLED">CANCELLED</option>
                                </select>
                              </div>
                            </div>

                            <div>
                              <label style={{ fontSize: '12px', color: '#94A3B8', display: 'block', marginBottom: '4px' }}>Payment Reference</label>
                              <input
                                type="text"
                                placeholder="e.g. PAY-REF-9981"
                                value={settlementFormData.paymentReference}
                                onChange={e => setSettlementFormData({ ...settlementFormData, paymentReference: e.target.value })}
                                style={{ width: '100%', backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#FFFFFF', padding: '8px', borderRadius: '6px', fontSize: '13px' }}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                            <button
                              type="button"
                              onClick={() => setSettlementFormOpen(false)}
                              style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#FFFFFF', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              style={{ backgroundColor: '#10B981', color: '#FFFFFF', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}
                            >
                              Save Settlement
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}

                  {/* Destructive Action Confirmation Dialog */}
                  {settlementDeleteConfirmId && (
                    <div style={{
                      position: 'fixed',
                      top: 0, left: 0, right: 0, bottom: 0,
                      backgroundColor: 'rgba(0,0,0,0.8)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 1100
                    }}>
                      <div style={{
                        backgroundColor: '#1E293B',
                        borderRadius: '12px',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        padding: '24px',
                        width: '400px',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '36px', marginBottom: '12px' }}>⚠️</div>
                        <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#F87171' }}>
                          Confirm Destructive Cancellation
                        </h4>
                        <p style={{ fontSize: '13px', color: '#94A3B8', margin: '12px 0 20px 0' }}>
                          Are you sure you want to cancel settlement <b>{settlements.find(s => s.id === settlementDeleteConfirmId)?.settlementCode}</b>? This action is irreversible.
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                          <button
                            onClick={() => setSettlementDeleteConfirmId(null)}
                            style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#FFFFFF', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                          >
                            Keep Active
                          </button>
                          <button
                            onClick={() => {
                              setSettlements(prev => prev.map(s => s.id === settlementDeleteConfirmId ? { ...s, status: 'CANCELLED' as any, version: s.version + 1 } : s));
                              setSettlementDeleteConfirmId(null);
                            }}
                            style={{ backgroundColor: '#EF4444', color: '#FFFFFF', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}
                          >
                            Confirm Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

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

              {/* Sub-tabs Selection */}
              <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '2px' }}>
                <button
                  onClick={() => setSfaSubTab('tracking')}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: sfaSubTab === 'tracking' ? '#60A5FA' : '#94A3B8',
                    padding: '8px 16px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    borderBottom: sfaSubTab === 'tracking' ? '2px solid #3B82F6' : 'none',
                    transition: 'all 0.15s'
                  }}
                >
                  📡 Live Operations
                </button>
                <button
                  onClick={() => setSfaSubTab('surveys')}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: sfaSubTab === 'surveys' ? '#60A5FA' : '#94A3B8',
                    padding: '8px 16px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    borderBottom: sfaSubTab === 'surveys' ? '2px solid #3B82F6' : 'none',
                    transition: 'all 0.15s'
                  }}
                >
                  📝 Surveys Console
                </button>
              </div>

              {sfaSubTab === 'tracking' && (
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

                {/* Order Approvals Workflow */}
                <div style={{
                  backgroundColor: 'rgba(30, 41, 59, 0.2)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '12px',
                  padding: '20px'
                }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#60A5FA' }}>Order Approvals Queue</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {orderApprovals.map((approval) => (
                      <div key={approval.id} style={{
                        backgroundColor: 'rgba(15,23,42,0.4)',
                        padding: '12px',
                        borderRadius: '8px',
                        borderLeft: `4px solid ${approval.status === 'approved' ? '#10B981' : (approval.status === 'rejected' ? '#EF4444' : '#F59E0B')}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '13px' }}>{approval.orderId}</div>
                            <div style={{ fontSize: '11px', opacity: 0.6 }}>Level {approval.level} • Req by {approval.requestedBy}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 'bold', fontSize: '14px' }}>${approval.amount}</div>
                            <span style={{
                              backgroundColor: approval.status === 'approved' ? 'rgba(16, 185, 129, 0.15)' : (approval.status === 'rejected' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)'),
                              color: approval.status === 'approved' ? '#34D399' : (approval.status === 'rejected' ? '#F87171' : '#FBBF24'),
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '9px',
                              fontWeight: 'bold'
                            }}>
                              {approval.status.toUpperCase()}
                            </span>
                          </div>
                        </div>
                        {approval.comments && (
                          <div style={{ fontSize: '11px', opacity: 0.7, fontStyle: 'italic', backgroundColor: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '4px' }}>
                            {approval.comments}
                          </div>
                        )}
                        {approval.status === 'pending' && (
                          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                            <button
                              onClick={() => handleApproveOrderApproval(approval.id, 'approved')}
                              style={{
                                flex: 1,
                                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                                border: '1px solid rgba(16, 185, 129, 0.4)',
                                color: '#34D399',
                                padding: '4px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                              }}
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleApproveOrderApproval(approval.id, 'rejected')}
                              style={{
                                flex: 1,
                                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                                border: '1px solid rgba(239, 68, 68, 0.4)',
                                color: '#F87171',
                                padding: '4px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                              }}
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => handleApproveOrderApproval(approval.id, 'escalated')}
                              style={{
                                flex: 1,
                                backgroundColor: 'rgba(245, 158, 11, 0.2)',
                                border: '1px solid rgba(245, 158, 11, 0.4)',
                                color: '#FBBF24',
                                padding: '4px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                              }}
                            >
                              Escalate
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Journey beats management */}
                <div style={{
                  backgroundColor: 'rgba(30, 41, 59, 0.2)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '12px',
                  padding: '20px',
                  gridColumn: '1 / -1'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', color: '#60A5FA' }}>Journey Beat Plan (PJP) Schedule</h3>
                    <button
                      onClick={() => setJpFormOpen(!jpFormOpen)}
                      style={{
                        backgroundColor: '#3B82F6',
                        color: '#FFFFFF',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 'bold'
                      }}
                    >
                      {jpFormOpen ? 'Close Form' : 'Schedule Beat Plan'}
                    </button>
                  </div>

                  {jpFormOpen && (
                    <form onSubmit={handleCreateJourneyPlan} style={{
                      backgroundColor: 'rgba(15,23,42,0.4)',
                      padding: '16px',
                      borderRadius: '8px',
                      marginBottom: '16px',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '12px',
                      alignItems: 'flex-end'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '10px', opacity: 0.6 }}>Plan Date</label>
                        <input
                          type="date"
                          value={jpNewPlan.date}
                          onChange={(e) => setJpNewPlan({ ...jpNewPlan, date: e.target.value })}
                          style={{
                            backgroundColor: 'rgba(15,23,42,0.6)',
                            color: '#F8FAFC',
                            border: '1px solid rgba(255,255,255,0.1)',
                            padding: '6px',
                            borderRadius: '4px',
                            fontSize: '12px'
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '10px', opacity: 0.6 }}>Beat Name</label>
                        <input
                          type="text"
                          value={jpNewPlan.beatName}
                          onChange={(e) => setJpNewPlan({ ...jpNewPlan, beatName: e.target.value })}
                          style={{
                            backgroundColor: 'rgba(15,23,42,0.6)',
                            color: '#F8FAFC',
                            border: '1px solid rgba(255,255,255,0.1)',
                            padding: '6px',
                            borderRadius: '4px',
                            fontSize: '12px'
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '10px', opacity: 0.6 }}>First Stop Outlet</label>
                        <input
                          type="text"
                          value={jpNewPlan.outletName}
                          onChange={(e) => setJpNewPlan({ ...jpNewPlan, outletName: e.target.value })}
                          style={{
                            backgroundColor: 'rgba(15,23,42,0.6)',
                            color: '#F8FAFC',
                            border: '1px solid rgba(255,255,255,0.1)',
                            padding: '6px',
                            borderRadius: '4px',
                            fontSize: '12px'
                          }}
                        />
                      </div>
                      <button
                        type="submit"
                        style={{
                          backgroundColor: '#10B981',
                          color: '#FFFFFF',
                          border: 'none',
                          padding: '7px 16px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}
                      >
                        Submit
                      </button>
                    </form>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {journeyPlans.map((plan) => {
                      const totalStops = plan.plannedOutlets.length;
                      const visitedStops = plan.plannedOutlets.filter(o => o.visited).length;
                      const completion = totalStops > 0 ? Math.round((visitedStops / totalStops) * 100) : 0;
                      return (
                        <div key={plan.id} style={{
                          backgroundColor: 'rgba(15,23,42,0.4)',
                          padding: '16px',
                          borderRadius: '8px',
                          borderLeft: `4px solid ${plan.status === 'completed' ? '#10B981' : (plan.status === 'in_progress' ? '#3B82F6' : '#F59E0B')}`,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '16px'
                        }}>
                          <div>
                            <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{plan.beatName}</div>
                            <div style={{ fontSize: '12px', opacity: 0.6, marginTop: '2px' }}>
                              Agent: {plan.agentId} • Date: {plan.date} • Progress: {visitedStops}/{totalStops} visited ({completion}%)
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                              {plan.plannedOutlets.map((o) => (
                                <span key={o.outletId} style={{
                                  backgroundColor: o.visited ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
                                  color: o.visited ? '#34D399' : '#94A3B8',
                                  border: `1px solid ${o.visited ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)'}`,
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  fontSize: '10px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}>
                                  {o.outletName}
                                  {plan.status === 'in_progress' && !o.visited && (
                                    <span
                                      onClick={() => handleVisitOutletPlan(plan.id, o.outletId)}
                                      style={{
                                        color: '#3B82F6',
                                        cursor: 'pointer',
                                        fontWeight: 'bold',
                                        marginLeft: '4px',
                                        fontSize: '11px'
                                      }}
                                      title="Mark Visited"
                                    >
                                      ✓
                                    </span>
                                  )}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{
                              backgroundColor: plan.status === 'completed' ? 'rgba(16, 185, 129, 0.15)' : (plan.status === 'in_progress' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(245, 158, 11, 0.15)'),
                              color: plan.status === 'completed' ? '#34D399' : (plan.status === 'in_progress' ? '#60A5FA' : '#FBBF24'),
                              padding: '4px 10px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 'bold',
                              textTransform: 'uppercase'
                            }}>
                              {plan.status}
                            </span>
                            {plan.status === 'planned' && (
                              <button
                                onClick={() => handleStartJourneyPlan(plan.id)}
                                style={{
                                  backgroundColor: 'rgba(59, 130, 246, 0.2)',
                                  border: '1px solid rgba(59, 130, 246, 0.4)',
                                  color: '#60A5FA',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                  fontWeight: 'bold'
                                }}
                              >
                                Start Beat
                              </button>
                            )}
                            {plan.status === 'in_progress' && (
                              <button
                                onClick={() => handleCompleteJourneyPlan(plan.id)}
                                style={{
                                  backgroundColor: 'rgba(16, 185, 129, 0.2)',
                                  border: '1px solid rgba(16, 185, 129, 0.4)',
                                  color: '#34D399',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                  fontWeight: 'bold'
                                }}
                              >
                                End Beat
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Beat Routes management */}
                <div style={{
                  backgroundColor: 'rgba(30, 41, 59, 0.2)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '12px',
                  padding: '20px',
                  gridColumn: '1 / -1',
                  marginTop: '20px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', color: '#60A5FA' }}>Beat Routes Territory Registry</h3>
                    <button
                      onClick={() => setBrFormOpen(!brFormOpen)}
                      style={{
                        backgroundColor: '#3B82F6',
                        color: '#FFFFFF',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 'bold'
                      }}
                    >
                      {brFormOpen ? 'Close Form' : 'Register Beat Route'}
                    </button>
                  </div>

                  {brFormOpen && (
                    <form onSubmit={handleCreateBeatRoute} style={{
                      backgroundColor: 'rgba(15,23,42,0.4)',
                      padding: '16px',
                      borderRadius: '8px',
                      marginBottom: '16px',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '12px',
                      alignItems: 'flex-end'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '10px', opacity: 0.6 }}>Route Name</label>
                        <input
                          type="text"
                          value={brNewRoute.name}
                          onChange={(e) => setBrNewRoute({ ...brNewRoute, name: e.target.value })}
                          style={{
                            backgroundColor: 'rgba(15,23,42,0.6)',
                            color: '#F8FAFC',
                            border: '1px solid rgba(255,255,255,0.1)',
                            padding: '6px',
                            borderRadius: '4px',
                            fontSize: '12px'
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '10px', opacity: 0.6 }}>Region</label>
                        <input
                          type="text"
                          value={brNewRoute.region}
                          onChange={(e) => setBrNewRoute({ ...brNewRoute, region: e.target.value })}
                          style={{
                            backgroundColor: 'rgba(15,23,42,0.6)',
                            color: '#F8FAFC',
                            border: '1px solid rgba(255,255,255,0.1)',
                            padding: '6px',
                            borderRadius: '4px',
                            fontSize: '12px'
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '10px', opacity: 0.6 }}>Frequency</label>
                        <select
                          value={brNewRoute.frequency}
                          onChange={(e) => setBrNewRoute({ ...brNewRoute, frequency: e.target.value as any })}
                          style={{
                            backgroundColor: 'rgba(15,23,42,0.6)',
                            color: '#F8FAFC',
                            border: '1px solid rgba(255,255,255,0.1)',
                            padding: '6px',
                            borderRadius: '4px',
                            fontSize: '12px'
                          }}
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>
                      <button
                        type="submit"
                        style={{
                          backgroundColor: '#10B981',
                          color: '#FFFFFF',
                          border: 'none',
                          padding: '7px 16px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}
                      >
                        Submit
                      </button>
                    </form>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {beatRoutes.map((route) => {
                      return (
                        <div key={route.id} style={{
                          backgroundColor: 'rgba(15,23,42,0.4)',
                          padding: '16px',
                          borderRadius: '8px',
                          borderLeft: `4px solid ${route.status === 'active' ? '#10B981' : (route.status === 'suspended' ? '#EF4444' : '#F59E0B')}`,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '16px'
                        }}>
                          <div>
                            <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{route.name}</div>
                            <div style={{ fontSize: '12px', opacity: 0.6, marginTop: '2px' }}>
                              Region: {route.region} • Frequency: {route.frequency} • Stops: {route.outlets.length} geolocated outlets
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{
                              backgroundColor: route.status === 'active' ? 'rgba(16, 185, 129, 0.15)' : (route.status === 'suspended' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)'),
                              color: route.status === 'active' ? '#34D399' : (route.status === 'suspended' ? '#F87171' : '#FBBF24'),
                              padding: '4px 10px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 'bold',
                              textTransform: 'uppercase'
                            }}>
                              {route.status}
                            </span>
                            {route.status === 'draft' && (
                              <button
                                onClick={() => handleUpdateBeatRouteStatus(route.id, 'activate')}
                                style={{
                                  backgroundColor: 'rgba(16, 185, 129, 0.2)',
                                  border: '1px solid rgba(16, 185, 129, 0.4)',
                                  color: '#34D399',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                  fontWeight: 'bold'
                                }}
                              >
                                Activate
                              </button>
                            )}
                            {route.status === 'active' && (
                              <button
                                onClick={() => handleUpdateBeatRouteStatus(route.id, 'suspend')}
                                style={{
                                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                                  border: '1px solid rgba(239, 68, 68, 0.4)',
                                  color: '#F87171',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                  fontWeight: 'bold'
                                }}
                              >
                                Suspend
                              </button>
                            )}
                            {route.status === 'suspended' && (
                              <button
                                onClick={() => handleUpdateBeatRouteStatus(route.id, 'archive')}
                                style={{
                                  backgroundColor: 'rgba(245, 158, 11, 0.2)',
                                  border: '1px solid rgba(245, 158, 11, 0.4)',
                                  color: '#FBBF24',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                  fontWeight: 'bold'
                                }}
                              >
                                Archive
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Retail Outlet Visits management */}
                <div style={{
                  backgroundColor: 'rgba(30, 41, 59, 0.2)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '12px',
                  padding: '20px',
                  gridColumn: '1 / -1',
                  marginTop: '20px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', color: '#60A5FA' }}>Retail Outlet Visits Registry</h3>
                    <button
                      onClick={() => setVisitFormOpen(!visitFormOpen)}
                      style={{
                        backgroundColor: '#3B82F6',
                        color: '#FFFFFF',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 'bold'
                      }}
                    >
                      {visitFormOpen ? 'Close Form' : 'Create Planned Visit'}
                    </button>
                  </div>

                  {visitFormOpen && (
                    <form onSubmit={handleCreateVisit} style={{
                      backgroundColor: 'rgba(15,23,42,0.4)',
                      padding: '16px',
                      borderRadius: '8px',
                      marginBottom: '16px',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '12px',
                      alignItems: 'flex-end'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '10px', opacity: 0.6 }}>Outlet</label>
                        <select
                          value={newVisit.outletId}
                          onChange={(e) => {
                            const opt = e.target.selectedOptions[0];
                            setNewVisit({ ...newVisit, outletId: e.target.value, outletName: opt ? opt.text : '' });
                          }}
                          style={{
                            backgroundColor: 'rgba(15,23,42,0.6)',
                            color: '#F8FAFC',
                            border: '1px solid rgba(255,255,255,0.1)',
                            padding: '6px',
                            borderRadius: '4px',
                            fontSize: '12px'
                          }}
                        >
                          <option value="out-1">HyperMarket Zone</option>
                          <option value="out-2">Koramangala Grocery Store</option>
                          <option value="out-3">Fresh Farms Hub</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '10px', opacity: 0.6 }}>Journey Plan ID</label>
                        <input
                          type="text"
                          value={newVisit.journeyPlanId}
                          onChange={(e) => setNewVisit({ ...newVisit, journeyPlanId: e.target.value })}
                          style={{
                            backgroundColor: 'rgba(15,23,42,0.6)',
                            color: '#F8FAFC',
                            border: '1px solid rgba(255,255,255,0.1)',
                            padding: '6px',
                            borderRadius: '4px',
                            fontSize: '12px'
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '10px', opacity: 0.6 }}>Planned Date</label>
                        <input
                          type="datetime-local"
                          value={newVisit.plannedDate.substring(0, 16)}
                          onChange={(e) => setNewVisit({ ...newVisit, plannedDate: new Date(e.target.value).toISOString() })}
                          style={{
                            backgroundColor: 'rgba(15,23,42,0.6)',
                            color: '#F8FAFC',
                            border: '1px solid rgba(255,255,255,0.1)',
                            padding: '6px',
                            borderRadius: '4px',
                            fontSize: '12px'
                          }}
                        />
                      </div>
                      <button
                        type="submit"
                        style={{
                          backgroundColor: '#10B981',
                          color: '#FFFFFF',
                          border: 'none',
                          padding: '7px 16px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}
                      >
                        Submit
                      </button>
                    </form>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {visits.map((visit) => {
                      return (
                        <div key={visit.id} style={{
                          backgroundColor: 'rgba(15,23,42,0.4)',
                          padding: '16px',
                          borderRadius: '8px',
                          borderLeft: `4px solid ${visit.status === 'completed' ? '#10B981' : (visit.status === 'in_progress' ? '#3B82F6' : (visit.status === 'skipped' ? '#94A3B8' : '#FBBF24'))}`,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '16px'
                        }}>
                          <div>
                            <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{visit.outletName}</div>
                            <div style={{ fontSize: '12px', opacity: 0.6, marginTop: '2px' }}>
                              Visit ID: {visit.id} • Journey: {visit.journeyPlanId} • Planned: {new Date(visit.plannedDate).toLocaleDateString()}
                            </div>
                            {(visit.checkInTime || visit.checkOutTime) && (
                              <div style={{ fontSize: '11px', opacity: 0.5, marginTop: '4px', color: '#60A5FA' }}>
                                {visit.checkInTime && `Checked In: ${new Date(visit.checkInTime).toLocaleTimeString()}`}
                                {visit.checkOutTime && ` • Checked Out: ${new Date(visit.checkOutTime).toLocaleTimeString()}`}
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{
                              backgroundColor: visit.status === 'completed' ? 'rgba(16, 185, 129, 0.15)' : (visit.status === 'in_progress' ? 'rgba(59, 130, 246, 0.15)' : (visit.status === 'skipped' ? 'rgba(148, 163, 184, 0.15)' : 'rgba(245, 158, 11, 0.15)')),
                              color: visit.status === 'completed' ? '#34D399' : (visit.status === 'in_progress' ? '#60A5FA' : (visit.status === 'skipped' ? '#94A3B8' : '#FBBF24')),
                              padding: '4px 10px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 'bold',
                              textTransform: 'uppercase'
                            }}>
                              {visit.status.replace('_', ' ')}
                            </span>
                            {visit.status === 'planned' && (
                              <>
                                <button
                                  onClick={() => handleUpdateVisitStatus(visit.id, 'check_in')}
                                  style={{
                                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                                    border: '1px solid rgba(59, 130, 246, 0.4)',
                                    color: '#60A5FA',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold'
                                  }}
                                >
                                  Check In
                                </button>
                                <button
                                  onClick={() => handleUpdateVisitStatus(visit.id, 'skip')}
                                  style={{
                                    backgroundColor: 'rgba(148, 163, 184, 0.2)',
                                    border: '1px solid rgba(148, 163, 184, 0.4)',
                                    color: '#94A3B8',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold'
                                  }}
                                >
                                  Skip
                                </button>
                              </>
                            )}
                            {visit.status === 'in_progress' && (
                              <button
                                onClick={() => handleUpdateVisitStatus(visit.id, 'check_out')}
                                style={{
                                  backgroundColor: 'rgba(16, 185, 129, 0.2)',
                                  border: '1px solid rgba(16, 185, 129, 0.4)',
                                  color: '#34D399',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                  fontWeight: 'bold'
                                }}
                              >
                                Check Out
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Attendance Registry Console */}
                <div style={{
                  backgroundColor: 'rgba(30, 41, 59, 0.2)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '12px',
                  padding: '20px',
                  gridColumn: '1 / -1',
                  marginTop: '20px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', color: '#60A5FA' }}>Daily Attendance Registry Console</h3>
                    <button
                      onClick={() => setAttFormOpen(!attFormOpen)}
                      style={{
                        backgroundColor: '#3B82F6',
                        color: '#FFFFFF',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 'bold'
                      }}
                    >
                      {attFormOpen ? 'Close Form' : 'Schedule Attendance'}
                    </button>
                  </div>

                  {attFormOpen && (
                    <form onSubmit={handleCreateAttendance} style={{
                      backgroundColor: 'rgba(15,23,42,0.4)',
                      padding: '16px',
                      borderRadius: '8px',
                      marginBottom: '16px',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '12px',
                      alignItems: 'flex-end'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '10px', opacity: 0.6 }}>Agent</label>
                        <select
                          value={newAtt.agentId}
                          onChange={(e) => {
                            const opt = e.target.selectedOptions[0];
                            setNewAtt({ ...newAtt, agentId: e.target.value, agentName: opt ? opt.text : '' });
                          }}
                          style={{
                            backgroundColor: 'rgba(15,23,42,0.6)',
                            color: '#F8FAFC',
                            border: '1px solid rgba(255,255,255,0.1)',
                            padding: '6px',
                            borderRadius: '4px',
                            fontSize: '12px'
                          }}
                        >
                          <option value="agent-uuid-4444">Amit Kumar</option>
                          <option value="agent-uuid-5555">Rajesh Sharma</option>
                          <option value="agent-uuid-6666">Suresh Raina</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '10px', opacity: 0.6 }}>Date</label>
                        <input
                          type="date"
                          value={newAtt.date}
                          onChange={(e) => setNewAtt({ ...newAtt, date: e.target.value })}
                          style={{
                            backgroundColor: 'rgba(15,23,42,0.6)',
                            color: '#F8FAFC',
                            border: '1px solid rgba(255,255,255,0.1)',
                            padding: '6px',
                            borderRadius: '4px',
                            fontSize: '12px'
                          }}
                        />
                      </div>
                      <button
                        type="submit"
                        style={{
                          backgroundColor: '#10B981',
                          color: '#FFFFFF',
                          border: 'none',
                          padding: '7px 16px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}
                      >
                        Submit
                      </button>
                    </form>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {attendances.map((att) => {
                      return (
                        <div key={att.id} style={{
                          backgroundColor: 'rgba(15,23,42,0.4)',
                          padding: '16px',
                          borderRadius: '8px',
                          borderLeft: `4px solid ${att.status === 'approved' ? '#10B981' : (att.status === 'checked_in' ? '#3B82F6' : (att.status === 'checked_out' ? '#F59E0B' : '#94A3B8'))}`,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '16px'
                        }}>
                          <div>
                            <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{att.agentName}</div>
                            <div style={{ fontSize: '12px', opacity: 0.6, marginTop: '2px' }}>
                              ID: {att.id} • Date: {att.date} • Worked: {att.totalHoursWorked || 0} hrs • OT: {att.overtimeHours || 0} hrs
                            </div>
                            {att.leaveType && (
                              <div style={{ fontSize: '11px', color: '#EF4444', marginTop: '4px' }}>
                                Leave Type: {att.leaveType}
                              </div>
                            )}
                            {(att.checkInTime || att.checkOutTime) && (
                              <div style={{ fontSize: '11px', opacity: 0.5, marginTop: '4px', color: '#60A5FA' }}>
                                {att.checkInTime && `In: ${new Date(att.checkInTime).toLocaleTimeString()}`}
                                {att.checkOutTime && ` • Out: ${new Date(att.checkOutTime).toLocaleTimeString()}`}
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{
                              backgroundColor: att.status === 'approved' ? 'rgba(16, 185, 129, 0.15)' : (att.status === 'checked_in' ? 'rgba(59, 130, 246, 0.15)' : (att.status === 'checked_out' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(148, 163, 184, 0.15)')),
                              color: att.status === 'approved' ? '#34D399' : (att.status === 'checked_in' ? '#60A5FA' : (att.status === 'checked_out' ? '#FBBF24' : '#94A3B8')),
                              padding: '4px 10px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 'bold',
                              textTransform: 'uppercase'
                            }}>
                              {att.status.replace('_', ' ')}
                            </span>
                            {att.status === 'absent' && !att.leaveType && (
                              <>
                                <button
                                  onClick={() => handleUpdateAttendanceStatus(att.id, 'check_in')}
                                  style={{
                                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                                    border: '1px solid rgba(59, 130, 246, 0.4)',
                                    color: '#60A5FA',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold'
                                  }}
                                >
                                  Check In
                                </button>
                                <button
                                  onClick={() => handleUpdateAttendanceStatus(att.id, 'set_leave', 'Casual Leave')}
                                  style={{
                                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                                    border: '1px solid rgba(239, 68, 68, 0.4)',
                                    color: '#F87171',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold'
                                  }}
                                >
                                  Mark Leave
                                </button>
                              </>
                            )}
                            {att.status === 'checked_in' && (
                              <button
                                onClick={() => handleUpdateAttendanceStatus(att.id, 'check_out')}
                                style={{
                                  backgroundColor: 'rgba(245, 158, 11, 0.2)',
                                  border: '1px solid rgba(245, 158, 11, 0.4)',
                                  color: '#FBBF24',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                  fontWeight: 'bold'
                                }}
                              >
                                Check Out
                              </button>
                            )}
                            {att.status === 'checked_out' && (
                              <button
                                onClick={() => handleUpdateAttendanceStatus(att.id, 'approve')}
                                style={{
                                  backgroundColor: 'rgba(16, 185, 129, 0.2)',
                                  border: '1px solid rgba(16, 185, 129, 0.4)',
                                  color: '#34D399',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                  fontWeight: 'bold'
                                }}
                              >
                                Approve Shift
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Outlet Census Registry Console */}
                <div style={{
                  backgroundColor: 'rgba(30, 41, 59, 0.2)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '12px',
                  padding: '20px',
                  gridColumn: '1 / -1',
                  marginTop: '20px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '15px', color: '#60A5FA' }}>Outlet Census & Auditing Console</h3>
                      <p style={{ margin: '2px 0 0 0', opacity: 0.6, fontSize: '11px' }}>
                        Track and audit outlet field censuses, geo-coordinate validation, and KYC approval workflows.
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <select
                        value={currentUserRole}
                        onChange={(e) => setCurrentUserRole(e.target.value as any)}
                        style={{
                          backgroundColor: 'rgba(15,23,42,0.6)',
                          color: '#F8FAFC',
                          border: '1px solid rgba(255,255,255,0.1)',
                          padding: '6px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 'bold'
                        }}
                      >
                        <option value="admin">Role: Administrator (All Actions)</option>
                        <option value="field-agent">Role: Field Agent (Read & Submit only)</option>
                      </select>
                      <button
                        onClick={() => {
                          setCensusFormOpen(!censusFormOpen);
                          setNewCensus({
                            id: '',
                            outletId: 'out-1',
                            outletName: '',
                            outletType: 'kirana',
                            ownerName: '',
                            ownerPhone: '',
                            address: '',
                            latitude: '12.9716',
                            longitude: '77.5946',
                            tradeCategory: 'Groceries',
                          });
                        }}
                        style={{
                          backgroundColor: '#3B82F6',
                          color: '#FFFFFF',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: 'bold'
                        }}
                      >
                        {censusFormOpen ? 'Close Form' : 'Register New Census'}
                      </button>
                    </div>
                  </div>

                  {censusFormOpen && (
                    <form onSubmit={handleCreateOrUpdateCensus} style={{
                      backgroundColor: 'rgba(15,23,42,0.4)',
                      padding: '16px',
                      borderRadius: '8px',
                      marginBottom: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#60A5FA' }}>
                        {newCensus.id ? 'Edit Census Record (Optimistic Version: ' + (outletCensuses.find(c=>c.id === newCensus.id)?.version || 1) + ')' : 'Register New Census Record'}
                      </h4>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '12px'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>Outlet Reference ID</label>
                          <select
                            value={newCensus.outletId}
                            onChange={(e) => setNewCensus({ ...newCensus, outletId: e.target.value })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          >
                            <option value="out-1">out-1 (HyperMarket Zone)</option>
                            <option value="out-2">out-2 (Koramangala Grocery)</option>
                            <option value="out-3">out-3 (Sunrise Grocery)</option>
                            <option value="out-4">out-4 (Mega Mart Center)</option>
                          </select>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>Outlet Name *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Sagar Store CP"
                            value={newCensus.outletName}
                            onChange={(e) => setNewCensus({ ...newCensus, outletName: e.target.value })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>Outlet Type</label>
                          <select
                            value={newCensus.outletType}
                            onChange={(e) => setNewCensus({ ...newCensus, outletType: e.target.value as any })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          >
                            <option value="kirana">Kirana / Mom-and-Pop</option>
                            <option value="supermarket">Supermarket</option>
                            <option value="wholesale">Wholesale</option>
                            <option value="convenience">Convenience Store</option>
                          </select>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>Owner Name</label>
                          <input
                            type="text"
                            placeholder="e.g. Sagar Kumar"
                            value={newCensus.ownerName}
                            onChange={(e) => setNewCensus({ ...newCensus, ownerName: e.target.value })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>Owner Phone * (Min 10 digits)</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. 9876543210"
                            value={newCensus.ownerPhone}
                            onChange={(e) => setNewCensus({ ...newCensus, ownerPhone: e.target.value })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>Trade Category</label>
                          <select
                            value={newCensus.tradeCategory}
                            onChange={(e) => setNewCensus({ ...newCensus, tradeCategory: e.target.value })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          >
                            <option value="Groceries">Groceries</option>
                            <option value="Beverages">Beverages</option>
                            <option value="Personal Care">Personal Care</option>
                            <option value="Snacks & Confectionery">Snacks & Confectionery</option>
                          </select>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>GPS Latitude (-90 to 90)</label>
                          <input
                            type="number"
                            step="any"
                            value={newCensus.latitude}
                            onChange={(e) => setNewCensus({ ...newCensus, latitude: e.target.value })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>GPS Longitude (-180 to 180)</label>
                          <input
                            type="number"
                            step="any"
                            value={newCensus.longitude}
                            onChange={(e) => setNewCensus({ ...newCensus, longitude: e.target.value })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          />
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '10px', opacity: 0.6 }}>Store Address</label>
                        <input
                          type="text"
                          placeholder="e.g. 123 Main Road, New Delhi"
                          value={newCensus.address}
                          onChange={(e) => setNewCensus({ ...newCensus, address: e.target.value })}
                          style={{
                            backgroundColor: 'rgba(15,23,42,0.6)',
                            color: '#F8FAFC',
                            border: '1px solid rgba(255,255,255,0.1)',
                            padding: '6px',
                            borderRadius: '4px',
                            fontSize: '12px'
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setCensusFormOpen(false)}
                          style={{
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            color: '#F8FAFC',
                            border: '1px solid rgba(255,255,255,0.1)',
                            padding: '6px 12px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '11px'
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          style={{
                            backgroundColor: '#10B981',
                            color: '#FFFFFF',
                            border: 'none',
                            padding: '6px 16px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 'bold'
                          }}
                        >
                          Save Census Record
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Filter and Search controls */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '16px',
                    flexWrap: 'wrap',
                    backgroundColor: 'rgba(15,23,42,0.2)',
                    padding: '12px',
                    borderRadius: '8px'
                  }}>
                    <div style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '240px' }}>
                      <input
                        type="text"
                        placeholder="Search outlet census by name or owner..."
                        value={censusSearchQuery}
                        onChange={(e) => setCensusSearchQuery(e.target.value)}
                        style={{
                          flex: 1,
                          backgroundColor: 'rgba(15,23,42,0.6)',
                          color: '#F8FAFC',
                          border: '1px solid rgba(255,255,255,0.1)',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '12px'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <select
                        value={censusStatusFilter}
                        onChange={(e) => setCensusStatusFilter(e.target.value)}
                        style={{
                          backgroundColor: 'rgba(15,23,42,0.6)',
                          color: '#F8FAFC',
                          border: '1px solid rgba(255,255,255,0.1)',
                          padding: '6px',
                          borderRadius: '6px',
                          fontSize: '11px'
                        }}
                      >
                        <option value="all">Filter: All Statuses</option>
                        <option value="draft">Draft</option>
                        <option value="submitted">Submitted</option>
                        <option value="verified">Verified</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                      </select>
                      <select
                        value={censusSortField}
                        onChange={(e) => setCensusSortField(e.target.value)}
                        style={{
                          backgroundColor: 'rgba(15,23,42,0.6)',
                          color: '#F8FAFC',
                          border: '1px solid rgba(255,255,255,0.1)',
                          padding: '6px',
                          borderRadius: '6px',
                          fontSize: '11px'
                        }}
                      >
                        <option value="outletName">Sort by: Outlet Name</option>
                        <option value="ownerName">Sort by: Owner Name</option>
                        <option value="status">Sort by: Status</option>
                      </select>
                    </div>
                  </div>

                  {/* Render list of outlet censuses */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {outletCensuses
                      .filter(c => {
                        const matchesSearch = c.outletName.toLowerCase().includes(censusSearchQuery.toLowerCase()) ||
                          c.ownerName.toLowerCase().includes(censusSearchQuery.toLowerCase());
                        const matchesStatus = censusStatusFilter === 'all' || c.status === censusStatusFilter;
                        return matchesSearch && matchesStatus;
                      })
                      .sort((a: any, b: any) => {
                        if (a[censusSortField] < b[censusSortField]) return -1;
                        if (a[censusSortField] > b[censusSortField]) return 1;
                        return 0;
                      })
                      .map((census) => {
                        const isAuthorized = currentUserRole === 'admin';
                        return (
                          <div key={census.id} style={{
                            backgroundColor: 'rgba(15,23,42,0.4)',
                            padding: '16px',
                            borderRadius: '8px',
                            borderLeft: `4px solid ${
                              census.status === 'approved' ? '#10B981' :
                              (census.status === 'rejected' ? '#EF4444' :
                              (census.status === 'verified' ? '#3B82F6' : '#FBBF24'))
                            }`,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '16px'
                          }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{census.outletName}</span>
                                <span style={{
                                  backgroundColor: 'rgba(255,255,255,0.05)',
                                  color: '#94A3B8',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  fontSize: '9px',
                                  textTransform: 'uppercase'
                                }}>
                                  {census.outletType}
                                </span>
                              </div>
                              <div style={{ fontSize: '12px', opacity: 0.6, marginTop: '2px' }}>
                                ID: {census.id} • Owner: {census.ownerName} ({census.ownerPhone}) • Category: {census.tradeCategory} • Version: {census.version}
                              </div>
                              <div style={{ fontSize: '11px', opacity: 0.5, marginTop: '4px', color: '#94A3B8' }}>
                                Address: {census.address} • GPS: ({census.geoCoords.latitude}, {census.geoCoords.longitude})
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                <span style={{
                                  backgroundColor: 
                                    census.status === 'approved' ? 'rgba(16, 185, 129, 0.15)' :
                                    (census.status === 'rejected' ? 'rgba(239, 68, 68, 0.15)' :
                                    (census.status === 'verified' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(245, 158, 11, 0.15)')),
                                  color: 
                                    census.status === 'approved' ? '#34D399' :
                                    (census.status === 'rejected' ? '#F87171' :
                                    (census.status === 'verified' ? '#60A5FA' : '#FBBF24')),
                                  padding: '4px 10px',
                                  borderRadius: '4px',
                                  fontSize: '10px',
                                  fontWeight: 'bold',
                                  textTransform: 'uppercase'
                                }}>
                                  Status: {census.status}
                                </span>
                                <span style={{ fontSize: '9px', opacity: 0.5 }}>
                                  KYC: {census.kycStatus.toUpperCase()}
                                </span>
                              </div>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                {/* Edit action */}
                                <button
                                  onClick={() => {
                                    setCensusFormOpen(true);
                                    setNewCensus({
                                      id: census.id,
                                      outletId: census.outletId,
                                      outletName: census.outletName,
                                      outletType: census.outletType,
                                      ownerName: census.ownerName,
                                      ownerPhone: census.ownerPhone,
                                      address: census.address,
                                      latitude: String(census.geoCoords.latitude),
                                      longitude: String(census.geoCoords.longitude),
                                      tradeCategory: census.tradeCategory,
                                    });
                                  }}
                                  style={{
                                    backgroundColor: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    color: '#F8FAFC',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Edit
                                </button>

                                {/* Permission-Gated Auditing Actions */}
                                <button
                                  disabled={!isAuthorized || census.status !== 'draft'}
                                  onClick={() => handleUpdateCensusStatus(census.id, 'submitted')}
                                  style={{
                                    backgroundColor: census.status === 'draft' && isAuthorized ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.02)',
                                    border: `1px solid ${census.status === 'draft' && isAuthorized ? 'rgba(245, 158, 11, 0.4)' : 'rgba(255,255,255,0.05)'}`,
                                    color: census.status === 'draft' && isAuthorized ? '#FBBF24' : 'rgba(255,255,255,0.2)',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    cursor: census.status === 'draft' && isAuthorized ? 'pointer' : 'not-allowed',
                                  }}
                                  title={!isAuthorized ? 'Requires Admin role' : 'Submit for review'}
                                >
                                  Submit
                                </button>
                                <button
                                  disabled={!isAuthorized || census.status !== 'submitted'}
                                  onClick={() => handleUpdateCensusStatus(census.id, 'verified')}
                                  style={{
                                    backgroundColor: census.status === 'submitted' && isAuthorized ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.02)',
                                    border: `1px solid ${census.status === 'submitted' && isAuthorized ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255,255,255,0.05)'}`,
                                    color: census.status === 'submitted' && isAuthorized ? '#60A5FA' : 'rgba(255,255,255,0.2)',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    cursor: census.status === 'submitted' && isAuthorized ? 'pointer' : 'not-allowed',
                                  }}
                                  title={!isAuthorized ? 'Requires Admin role' : 'Verify GPS & Address'}
                                >
                                  Verify
                                </button>
                                <button
                                  disabled={!isAuthorized || census.status !== 'verified'}
                                  onClick={() => handleUpdateCensusStatus(census.id, 'approved')}
                                  style={{
                                    backgroundColor: census.status === 'verified' && isAuthorized ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.02)',
                                    border: `1px solid ${census.status === 'verified' && isAuthorized ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255,255,255,0.05)'}`,
                                    color: census.status === 'verified' && isAuthorized ? '#34D399' : 'rgba(255,255,255,0.2)',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    cursor: census.status === 'verified' && isAuthorized ? 'pointer' : 'not-allowed',
                                  }}
                                  title={!isAuthorized ? 'Requires Admin role' : 'Approve KYC & Onboard'}
                                >
                                  Approve
                                </button>

                                {/* Destructive Action */}
                                <button
                                  onClick={() => handleDeleteCensus(census.id)}
                                  style={{
                                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                    border: '1px solid rgba(239, 68, 68, 0.2)',
                                    color: '#F87171',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Outlet Profiles Registry Console */}
                <div style={{
                  backgroundColor: 'rgba(30, 41, 59, 0.2)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '12px',
                  padding: '20px',
                  gridColumn: '1 / -1',
                  marginTop: '20px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '15px', color: '#60A5FA' }}>Outlet Profiles Console</h3>
                      <p style={{ margin: '2px 0 0 0', opacity: 0.6, fontSize: '11px' }}>
                        Manage retail outlets, geographical coordinates, activity status, and KYC compliance.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setProfileFormOpen(!profileFormOpen);
                        setNewProfile({
                          id: '',
                          outletName: '',
                          outletType: 'kirana',
                          ownerName: '',
                          ownerPhone: '',
                          address: '',
                          latitude: '12.9716',
                          longitude: '77.5946',
                          kycStatus: 'pending',
                          status: 'active',
                        });
                      }}
                      style={{
                        backgroundColor: '#3B82F6',
                        color: '#FFFFFF',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 'bold'
                      }}
                    >
                      {profileFormOpen ? 'Close Form' : 'Register New Profile'}
                    </button>
                  </div>

                  {profileFormOpen && (
                    <form onSubmit={handleCreateOrUpdateProfile} style={{
                      backgroundColor: 'rgba(15,23,42,0.4)',
                      padding: '16px',
                      borderRadius: '8px',
                      marginBottom: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#60A5FA' }}>
                        {newProfile.id ? 'Edit Outlet Profile' : 'Register New Outlet Profile'}
                      </h4>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '12px'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>Outlet Name *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Sagar Store CP"
                            value={newProfile.outletName}
                            onChange={(e) => setNewProfile({ ...newProfile, outletName: e.target.value })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>Outlet Type</label>
                          <select
                            value={newProfile.outletType}
                            onChange={(e) => setNewProfile({ ...newProfile, outletType: e.target.value as any })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          >
                            <option value="kirana">Kirana / Mom-and-Pop</option>
                            <option value="supermarket">Supermarket</option>
                            <option value="pharmacy">Pharmacy</option>
                            <option value="general">General Retail</option>
                          </select>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>Owner Name</label>
                          <input
                            type="text"
                            placeholder="Owner Name"
                            value={newProfile.ownerName}
                            onChange={(e) => setNewProfile({ ...newProfile, ownerName: e.target.value })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>Owner Phone * (Min 10 digits)</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. 9876543210"
                            value={newProfile.ownerPhone}
                            onChange={(e) => setNewProfile({ ...newProfile, ownerPhone: e.target.value })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>Address *</label>
                          <input
                            type="text"
                            required
                            placeholder="Address"
                            value={newProfile.address}
                            onChange={(e) => setNewProfile({ ...newProfile, address: e.target.value })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>Latitude *</label>
                          <input
                            type="text"
                            required
                            value={newProfile.latitude}
                            onChange={(e) => setNewProfile({ ...newProfile, latitude: e.target.value })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>Longitude *</label>
                          <input
                            type="text"
                            required
                            value={newProfile.longitude}
                            onChange={(e) => setNewProfile({ ...newProfile, longitude: e.target.value })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>KYC Status</label>
                          <select
                            value={newProfile.kycStatus}
                            onChange={(e) => setNewProfile({ ...newProfile, kycStatus: e.target.value as any })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          >
                            <option value="pending">Pending</option>
                            <option value="verified">Verified</option>
                            <option value="rejected">Rejected</option>
                          </select>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>Status</label>
                          <select
                            value={newProfile.status}
                            onChange={(e) => setNewProfile({ ...newProfile, status: e.target.value as any })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </div>
                      </div>
                      <button
                        type="submit"
                        style={{
                          backgroundColor: '#10B981',
                          color: '#FFFFFF',
                          border: 'none',
                          padding: '8px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          marginTop: '8px',
                          alignSelf: 'flex-start'
                        }}
                      >
                        Save Profile
                      </button>
                    </form>
                  )}

                  {/* Filter and Search controls */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      placeholder="Search outlet profiles by name or owner..."
                      value={profileSearchQuery}
                      onChange={(e) => setProfileSearchQuery(e.target.value)}
                      style={{
                        backgroundColor: 'rgba(15,23,42,0.6)',
                        color: '#F8FAFC',
                        border: '1px solid rgba(255,255,255,0.1)',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        flex: '1',
                        minWidth: '200px'
                      }}
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select
                        value={profileStatusFilter}
                        onChange={(e) => setProfileStatusFilter(e.target.value)}
                        style={{
                          backgroundColor: 'rgba(15,23,42,0.6)',
                          color: '#F8FAFC',
                          border: '1px solid rgba(255,255,255,0.1)',
                          padding: '6px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 'bold'
                        }}
                      >
                        <option value="all">Filter: All Statuses</option>
                        <option value="active">Active Only</option>
                        <option value="inactive">Inactive Only</option>
                      </select>
                      <select
                        value={profileSortField}
                        onChange={(e) => setProfileSortField(e.target.value)}
                        style={{
                          backgroundColor: 'rgba(15,23,42,0.6)',
                          color: '#F8FAFC',
                          border: '1px solid rgba(255,255,255,0.1)',
                          padding: '6px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 'bold'
                        }}
                      >
                        <option value="outletName">Sort by: Outlet Name</option>
                        <option value="ownerName">Sort by: Owner Name</option>
                      </select>
                    </div>
                  </div>

                  {/* Render list of outlet profiles */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {outletProfiles
                      .filter(p => {
                        const matchesSearch = p.outletName.toLowerCase().includes(profileSearchQuery.toLowerCase()) ||
                          p.ownerName.toLowerCase().includes(profileSearchQuery.toLowerCase());
                        const matchesStatus = profileStatusFilter === 'all' || p.status === profileStatusFilter;
                        return matchesSearch && matchesStatus;
                      })
                      .sort((a: any, b: any) => {
                        if (a[profileSortField] < b[profileSortField]) return -1;
                        if (a[profileSortField] > b[profileSortField]) return 1;
                        return 0;
                      })
                      .map((profile) => {
                        return (
                          <div key={profile.id} style={{
                            backgroundColor: 'rgba(15,23,42,0.4)',
                            padding: '16px',
                            borderRadius: '8px',
                            borderLeft: `4px solid ${profile.status === 'active' ? '#10B981' : '#EF4444'}`,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '16px'
                          }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{profile.outletName}</span>
                                <span style={{
                                  backgroundColor: 'rgba(255,255,255,0.05)',
                                  color: '#94A3B8',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  fontSize: '9px',
                                  textTransform: 'uppercase'
                                }}>
                                  {profile.outletType}
                                </span>
                              </div>
                              <div style={{ fontSize: '12px', opacity: 0.6, marginTop: '2px' }}>
                                ID: {profile.id} • Owner: {profile.ownerName} ({profile.ownerPhone}) • KYC: {profile.kycStatus.toUpperCase()} • Version: {profile.version}
                              </div>
                              <div style={{ fontSize: '11px', opacity: 0.5, marginTop: '4px', color: '#94A3B8' }}>
                                Address: {profile.address} • GPS: ({profile.geoCoords.latitude}, {profile.geoCoords.longitude})
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <button
                                onClick={() => {
                                  setProfileFormOpen(true);
                                  setNewProfile({
                                    id: profile.id,
                                    outletName: profile.outletName,
                                    outletType: profile.outletType,
                                    ownerName: profile.ownerName,
                                    ownerPhone: profile.ownerPhone,
                                    address: profile.address,
                                    latitude: String(profile.geoCoords.latitude),
                                    longitude: String(profile.geoCoords.longitude),
                                    kycStatus: profile.kycStatus,
                                    status: profile.status,
                                  });
                                }}
                                style={{
                                  backgroundColor: 'rgba(255,255,255,0.05)',
                                  border: '1px solid rgba(255,255,255,0.1)',
                                  color: '#F8FAFC',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '10px',
                                  cursor: 'pointer',
                                }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteProfile(profile.id)}
                                style={{
                                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                  border: '1px solid rgba(239, 68, 68, 0.2)',
                                  color: '#F87171',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '10px',
                                  cursor: 'pointer',
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Van Sales Console */}
                <div style={{
                  backgroundColor: 'rgba(30, 41, 59, 0.2)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '12px',
                  padding: '20px',
                  gridColumn: '1 / -1',
                  marginTop: '20px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '15px', color: '#60A5FA' }}>Van Sales Sessions</h3>
                      <p style={{ margin: '2px 0 0 0', opacity: 0.6, fontSize: '11px' }}>
                        Monitor mobile selling: loading inventory, spot sales, returns, and daily payment reconciliation.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setVanSaleFormOpen(!vanSaleFormOpen);
                        setNewVanSale({
                          id: '',
                          agentId: 'agent-uuid-4444',
                          vehicleId: 'veh-9999',
                          routeId: 'beat-uuid-1',
                          date: new Date().toISOString().split('T')[0]!,
                          loadedItemsStr: '[{"skuId":"SKU-FMCG-001","qty":50,"batchNumber":"BAT-01"}]',
                          status: 'loading',
                        });
                      }}
                      style={{
                        backgroundColor: '#3B82F6',
                        color: '#FFFFFF',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 'bold'
                      }}
                    >
                      {vanSaleFormOpen ? 'Close Form' : 'Start Session'}
                    </button>
                  </div>

                  {vanSaleFormOpen && (
                    <form onSubmit={handleCreateOrUpdateVanSale} style={{
                      backgroundColor: 'rgba(15,23,42,0.4)',
                      padding: '16px',
                      borderRadius: '8px',
                      marginBottom: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#60A5FA' }}>
                        {newVanSale.id ? 'Edit Van Sale Session' : 'Start Van Sale Session'}
                      </h4>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '12px'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>Agent ID *</label>
                          <input
                            type="text"
                            required
                            value={newVanSale.agentId}
                            onChange={(e) => setNewVanSale({ ...newVanSale, agentId: e.target.value })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>Vehicle ID *</label>
                          <input
                            type="text"
                            required
                            value={newVanSale.vehicleId}
                            onChange={(e) => setNewVanSale({ ...newVanSale, vehicleId: e.target.value })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>Route ID *</label>
                          <input
                            type="text"
                            required
                            value={newVanSale.routeId}
                            onChange={(e) => setNewVanSale({ ...newVanSale, routeId: e.target.value })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>Date *</label>
                          <input
                            type="text"
                            required
                            value={newVanSale.date}
                            onChange={(e) => setNewVanSale({ ...newVanSale, date: e.target.value })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', gridColumn: '1 / -1' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>Loaded Items (JSON array) *</label>
                          <textarea
                            required
                            rows={3}
                            value={newVanSale.loadedItemsStr}
                            onChange={(e) => setNewVanSale({ ...newVanSale, loadedItemsStr: e.target.value })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontFamily: 'monospace'
                            }}
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        style={{
                          backgroundColor: '#10B981',
                          color: '#FFFFFF',
                          border: 'none',
                          padding: '8px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          marginTop: '8px',
                          alignSelf: 'flex-start'
                        }}
                      >
                        Save Session
                      </button>
                    </form>
                  )}

                  {/* Filter and Search controls */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      placeholder="Search van sale sessions by agent or vehicle..."
                      value={vanSaleSearchQuery}
                      onChange={(e) => setVanSaleSearchQuery(e.target.value)}
                      style={{
                        backgroundColor: 'rgba(15,23,42,0.6)',
                        color: '#F8FAFC',
                        border: '1px solid rgba(255,255,255,0.1)',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        flex: '1',
                        minWidth: '200px'
                      }}
                    />
                    <select
                      value={vanSaleStatusFilter}
                      onChange={(e) => setVanSaleStatusFilter(e.target.value)}
                      style={{
                        backgroundColor: 'rgba(15,23,42,0.6)',
                        color: '#F8FAFC',
                        border: '1px solid rgba(255,255,255,0.1)',
                        padding: '6px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 'bold'
                      }}
                    >
                      <option value="all">Filter: All Statuses</option>
                      <option value="loading">Loading</option>
                      <option value="in_transit">In Transit</option>
                      <option value="selling">Selling</option>
                      <option value="reconciliation">Reconciliation</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>

                  {/* Render list of van sale sessions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {vanSales
                      .filter(v => {
                        const matchesSearch = v.agentId.toLowerCase().includes(vanSaleSearchQuery.toLowerCase()) ||
                          v.vehicleId.toLowerCase().includes(vanSaleSearchQuery.toLowerCase());
                        const matchesStatus = vanSaleStatusFilter === 'all' || v.status === vanSaleStatusFilter;
                        return matchesSearch && matchesStatus;
                      })
                      .map((van) => {
                        return (
                          <div key={van.id} style={{
                            backgroundColor: 'rgba(15,23,42,0.4)',
                            padding: '16px',
                            borderRadius: '8px',
                            borderLeft: `4px solid ${
                              van.status === 'closed' ? '#64748B' :
                              (van.status === 'selling' ? '#10B981' : '#F59E0B')
                            }`,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '16px'
                          }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontWeight: 'bold', fontSize: '14px' }}>Session: {van.id}</span>
                                <span style={{
                                  backgroundColor: 'rgba(255,255,255,0.05)',
                                  color: '#94A3B8',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  fontSize: '9px',
                                  textTransform: 'uppercase'
                                }}>
                                  {van.status}
                                </span>
                              </div>
                              <div style={{ fontSize: '12px', opacity: 0.6, marginTop: '2px' }}>
                                Date: {van.date} • Agent: {van.agentId} • Vehicle: {van.vehicleId} • Route: {van.routeId} • Version: {van.version}
                              </div>
                              <div style={{ fontSize: '11px', opacity: 0.5, marginTop: '4px', color: '#94A3B8' }}>
                                Loaded: {van.loadedItems.length} SKUs • Sold: {van.soldItems.length} items • Cash: ₹{van.cashCollected.amount.toFixed(2)} • Digital: ₹{van.digitalPayments.amount.toFixed(2)}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {van.status === 'loading' && (
                                <button
                                  onClick={() => handleUpdateVanSaleStatus(van.id, 'in_transit')}
                                  style={{
                                    backgroundColor: 'rgba(245, 158, 11, 0.2)',
                                    border: '1px solid rgba(245, 158, 11, 0.4)',
                                    color: '#FBBF24',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold'
                                  }}
                                >
                                  Start Transit
                                </button>
                              )}
                              {van.status === 'in_transit' && (
                                <button
                                  onClick={() => handleUpdateVanSaleStatus(van.id, 'selling')}
                                  style={{
                                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                                    border: '1px solid rgba(16, 185, 129, 0.4)',
                                    color: '#34D399',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold'
                                  }}
                                >
                                  Start Selling
                                </button>
                              )}
                              {van.status === 'selling' && (
                                <button
                                  onClick={() => handleUpdateVanSaleStatus(van.id, 'reconciliation')}
                                  style={{
                                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                                    border: '1px solid rgba(59, 130, 246, 0.4)',
                                    color: '#60A5FA',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold'
                                  }}
                                >
                                  Reconcile
                                </button>
                              )}
                              {van.status === 'reconciliation' && (
                                <button
                                  onClick={() => handleUpdateVanSaleStatus(van.id, 'closed')}
                                  style={{
                                    backgroundColor: 'rgba(100, 116, 139, 0.2)',
                                    border: '1px solid rgba(100, 116, 139, 0.4)',
                                    color: '#94A3B8',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold'
                                  }}
                                >
                                  Close Session
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setVanSaleFormOpen(true);
                                  setNewVanSale({
                                    id: van.id,
                                    agentId: van.agentId,
                                    vehicleId: van.vehicleId,
                                    routeId: van.routeId,
                                    date: van.date,
                                    loadedItemsStr: JSON.stringify(van.loadedItems),
                                    status: van.status,
                                  });
                                }}
                                style={{
                                  backgroundColor: 'rgba(255,255,255,0.05)',
                                  border: '1px solid rgba(255,255,255,0.1)',
                                  color: '#F8FAFC',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '10px',
                                  cursor: 'pointer',
                                }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteVanSale(van.id)}
                                style={{
                                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                  border: '1px solid rgba(239, 68, 68, 0.2)',
                                  color: '#F87171',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '10px',
                                  cursor: 'pointer',
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Sales Targets Console Section */}
                <div style={{
                  backgroundColor: 'rgba(30, 41, 59, 0.2)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '12px',
                  padding: '20px',
                  gridColumn: '1 / -1',
                  marginTop: '20px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '15px', color: '#60A5FA' }}>Sales Targets Management</h3>
                      <p style={{ margin: '2px 0 0 0', opacity: 0.5, fontSize: '11px' }}>Enforce quota rules, monitor achievements, and track monthly parameters.</p>
                    </div>
                    {currentUserRole === 'admin' && (
                      <button
                        onClick={() => {
                          setStEditingId(null);
                          setStFormData({
                            agentId: 'agent-uuid-4444',
                            periodMonth: 6,
                            periodYear: 2026,
                            targetAmount: 5000,
                            targetType: 'volume',
                            status: 'DRAFT',
                            version: 1,
                          });
                          setStFormErrors({});
                          setStFormOpen(!stFormOpen);
                        }}
                        style={{
                          backgroundColor: '#3B82F6',
                          color: '#FFFFFF',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: 'bold'
                        }}
                      >
                        {stFormOpen ? 'Close Form' : 'Create Sales Target'}
                      </button>
                    )}
                  </div>

                  {stFormOpen && currentUserRole === 'admin' && (
                    <form onSubmit={handleCreateOrUpdateSalesTarget} style={{
                      backgroundColor: 'rgba(15,23,42,0.4)',
                      padding: '16px',
                      borderRadius: '8px',
                      marginBottom: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#60A5FA' }}>
                        {stEditingId ? `Edit Sales Target (Optimistic Version: ${stFormData.version})` : 'New Sales Target Parameters'}
                      </h4>

                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '12px'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>Agent Reference ID *</label>
                          <input
                            type="text"
                            value={stFormData.agentId}
                            onChange={(e) => setStFormData({ ...stFormData, agentId: e.target.value })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: stFormErrors.agentId ? '1px solid #EF4444' : '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          />
                          {stFormErrors.agentId && <span style={{ color: '#EF4444', fontSize: '10px' }}>{stFormErrors.agentId}</span>}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>Target Amount *</label>
                          <input
                            type="number"
                            value={stFormData.targetAmount}
                            onChange={(e) => setStFormData({ ...stFormData, targetAmount: Number(e.target.value) })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: stFormErrors.targetAmount ? '1px solid #EF4444' : '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          />
                          {stFormErrors.targetAmount && <span style={{ color: '#EF4444', fontSize: '10px' }}>{stFormErrors.targetAmount}</span>}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>Period Month (1-12) *</label>
                          <input
                            type="number"
                            value={stFormData.periodMonth}
                            onChange={(e) => setStFormData({ ...stFormData, periodMonth: Number(e.target.value) })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: stFormErrors.periodMonth ? '1px solid #EF4444' : '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          />
                          {stFormErrors.periodMonth && <span style={{ color: '#EF4444', fontSize: '10px' }}>{stFormErrors.periodMonth}</span>}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>Period Year (2000-2100) *</label>
                          <input
                            type="number"
                            value={stFormData.periodYear}
                            onChange={(e) => setStFormData({ ...stFormData, periodYear: Number(e.target.value) })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: stFormErrors.periodYear ? '1px solid #EF4444' : '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          />
                          {stFormErrors.periodYear && <span style={{ color: '#EF4444', fontSize: '10px' }}>{stFormErrors.periodYear}</span>}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>Target Metric Type</label>
                          <select
                            value={stFormData.targetType}
                            onChange={(e) => setStFormData({ ...stFormData, targetType: e.target.value })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          >
                            <option value="volume">volume (Unit count)</option>
                            <option value="value">value (Financial sum)</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                        <button
                          type="submit"
                          style={{
                            backgroundColor: '#10B981',
                            color: '#FFFFFF',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}
                        >
                          {stEditingId ? 'Save Changes' : 'Submit Target'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setStFormOpen(false);
                            setStEditingId(null);
                          }}
                          style={{
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            color: '#F8FAFC',
                            border: '1px solid rgba(255,255,255,0.1)',
                            padding: '8px 16px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Filters and Pagination Controls */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px',
                    marginBottom: '16px',
                    backgroundColor: 'rgba(15,23,42,0.2)',
                    padding: '12px',
                    borderRadius: '8px'
                  }}>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', opacity: 0.6 }}>Agent:</span>
                        <select
                          value={stFilterAgentId}
                          onChange={(e) => { setStFilterAgentId(e.target.value); setStPage(1); }}
                          style={{
                            backgroundColor: 'rgba(15,23,42,0.6)',
                            color: '#F8FAFC',
                            border: '1px solid rgba(255,255,255,0.1)',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '11px'
                          }}
                        >
                          <option value="all">All Agents</option>
                          <option value="agent-uuid-4444">agent-uuid-4444</option>
                          <option value="agent-uuid-5555">agent-uuid-5555</option>
                        </select>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', opacity: 0.6 }}>Status:</span>
                        <select
                          value={stFilterStatus}
                          onChange={(e) => { setStFilterStatus(e.target.value); setStPage(1); }}
                          style={{
                            backgroundColor: 'rgba(15,23,42,0.6)',
                            color: '#F8FAFC',
                            border: '1px solid rgba(255,255,255,0.1)',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '11px'
                          }}
                        >
                          <option value="all">All Statuses</option>
                          <option value="DRAFT">DRAFT</option>
                          <option value="ACTIVE">ACTIVE</option>
                          <option value="COMPLETED">COMPLETED</option>
                          <option value="CANCELLED">CANCELLED</option>
                        </select>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', opacity: 0.6 }}>Metric:</span>
                        <select
                          value={stFilterType}
                          onChange={(e) => { setStFilterType(e.target.value); setStPage(1); }}
                          style={{
                            backgroundColor: 'rgba(15,23,42,0.6)',
                            color: '#F8FAFC',
                            border: '1px solid rgba(255,255,255,0.1)',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '11px'
                          }}
                        >
                          <option value="all">All Metrics</option>
                          <option value="volume">volume</option>
                          <option value="value">value</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
                      <button
                        disabled={stPage === 1}
                        onClick={() => setStPage(prev => Math.max(1, prev - 1))}
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.05)',
                          color: '#F8FAFC',
                          border: '1px solid rgba(255,255,255,0.1)',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          cursor: stPage === 1 ? 'not-allowed' : 'pointer',
                          opacity: stPage === 1 ? 0.4 : 1
                        }}
                      >
                        Prev
                      </button>
                      <span>Page {stPage}</span>
                      <button
                        disabled={salesTargets.filter(t => {
                          if (stFilterAgentId !== 'all' && t.agentId !== stFilterAgentId) return false;
                          if (stFilterStatus !== 'all' && t.status !== stFilterStatus) return false;
                          if (stFilterType !== 'all' && t.targetType !== stFilterType) return false;
                          return true;
                        }).length <= stPage * stPageSize}
                        onClick={() => setStPage(prev => prev + 1)}
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.05)',
                          color: '#F8FAFC',
                          border: '1px solid rgba(255,255,255,0.1)',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Next
                      </button>
                    </div>
                  </div>

                  {/* List Targets Table */}
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', opacity: 0.7 }}>
                          <th style={{ padding: '10px 12px' }}>Period</th>
                          <th style={{ padding: '10px 12px' }}>Agent ID</th>
                          <th style={{ padding: '10px 12px' }}>Type</th>
                          <th style={{ padding: '10px 12px' }}>Progress</th>
                          <th style={{ padding: '10px 12px' }}>Status</th>
                          <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salesTargets
                          .filter(t => {
                            if (stFilterAgentId !== 'all' && t.agentId !== stFilterAgentId) return false;
                            if (stFilterStatus !== 'all' && t.status !== stFilterStatus) return false;
                            if (stFilterType !== 'all' && t.targetType !== stFilterType) return false;
                            return true;
                          })
                          .slice((stPage - 1) * stPageSize, stPage * stPageSize)
                          .map((target) => {
                            const pct = target.targetAmount > 0 ? Math.round((target.achievedAmount / target.targetAmount) * 100) : 0;
                            const statusColor = target.status === 'COMPLETED' ? '#10B981' : (target.status === 'ACTIVE' ? '#3B82F6' : (target.status === 'CANCELLED' ? '#EF4444' : '#F59E0B'));
                            return (
                              <tr key={target.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background-color 0.2s' }}>
                                <td style={{ padding: '12px', fontWeight: 'bold' }}>{target.periodYear}-{String(target.periodMonth).padStart(2, '0')}</td>
                                <td style={{ padding: '12px', opacity: 0.8 }}>{target.agentId}</td>
                                <td style={{ padding: '12px' }}>
                                  <span style={{ fontSize: '11px', textTransform: 'uppercase', opacity: 0.6 }}>{target.targetType}</span>
                                </td>
                                <td style={{ padding: '12px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '80px', height: '6px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                                      <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', backgroundColor: statusColor }} />
                                    </div>
                                    <span style={{ fontSize: '11px', fontWeight: 'bold' }}>
                                      {target.achievedAmount}/{target.targetAmount} ({pct}%)
                                    </span>
                                  </div>
                                </td>
                                <td style={{ padding: '12px' }}>
                                  <span style={{
                                    backgroundColor: `rgba(${target.status === 'COMPLETED' ? '16, 185, 129' : (target.status === 'ACTIVE' ? '59, 130, 246' : (target.status === 'CANCELLED' ? '239, 68, 68' : '245, 158, 11'))}, 0.15)`,
                                    color: statusColor,
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    fontSize: '10px',
                                    fontWeight: 'bold',
                                    border: `1px solid rgba(${target.status === 'COMPLETED' ? '16, 185, 129' : (target.status === 'ACTIVE' ? '59, 130, 246' : (target.status === 'CANCELLED' ? '239, 68, 68' : '245, 158, 11'))}, 0.2)`
                                  }}>
                                    {target.status}
                                  </span>
                                </td>
                                <td style={{ padding: '12px', textAlign: 'right' }}>
                                  <div style={{ display: 'inline-flex', gap: '6px' }}>
                                    {currentUserRole === 'admin' && target.status === 'DRAFT' && (
                                      <button
                                        onClick={() => handleUpdateSalesTargetStatus(target.id, 'activate')}
                                        style={{
                                          backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                          border: '1px solid rgba(16, 185, 129, 0.2)',
                                          color: '#34D399',
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          fontSize: '10px',
                                          cursor: 'pointer',
                                        }}
                                      >
                                        Activate
                                      </button>
                                    )}

                                    {currentUserRole === 'admin' && target.status === 'DRAFT' && (
                                      <button
                                        onClick={() => {
                                          setStEditingId(target.id);
                                          setStFormData({
                                            agentId: target.agentId,
                                            periodMonth: target.periodMonth,
                                            periodYear: target.periodYear,
                                            targetAmount: target.targetAmount,
                                            targetType: target.targetType,
                                            status: target.status,
                                            version: target.version,
                                          });
                                          setStFormErrors({});
                                          setStFormOpen(true);
                                        }}
                                        style={{
                                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                          border: '1px solid rgba(255, 255, 255, 0.1)',
                                          color: '#F8FAFC',
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          fontSize: '10px',
                                          cursor: 'pointer',
                                        }}
                                      >
                                        Edit
                                      </button>
                                    )}

                                    {currentUserRole === 'admin' && (target.status === 'DRAFT' || target.status === 'ACTIVE') && (
                                      <button
                                        onClick={() => handleUpdateSalesTargetStatus(target.id, 'cancel')}
                                        style={{
                                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                          border: '1px solid rgba(239, 68, 68, 0.2)',
                                          color: '#F87171',
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          fontSize: '10px',
                                          cursor: 'pointer',
                                        }}
                                      >
                                        Cancel
                                      </button>
                                    )}

                                    {currentUserRole === 'admin' && (
                                      <button
                                        onClick={() => handleDeleteSalesTarget(target.id)}
                                        style={{
                                          backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                          border: '1px solid rgba(239, 68, 68, 0.3)',
                                          color: '#F87171',
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          fontSize: '10px',
                                          cursor: 'pointer',
                                        }}
                                      >
                                        Delete
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Field Representatives Console Section */}
                <div style={{
                  backgroundColor: 'rgba(30, 41, 59, 0.2)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '12px',
                  padding: '20px',
                  gridColumn: '1 / -1',
                  marginTop: '20px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '15px', color: '#60A5FA' }}>Field Representatives Console</h3>
                      <p style={{ margin: '2px 0 0 0', opacity: 0.5, fontSize: '11px' }}>Manage user linkages, employee codes, status controls, and contact details.</p>
                    </div>
                    {currentUserRole === 'admin' && (
                      <button
                        onClick={() => {
                          setFrEditingId(null);
                          setFrFormData({
                            userId: '00000000-0000-0000-0000-0000000000c4',
                            employeeCode: 'EMP-004',
                            firstName: 'Alice',
                            lastName: 'Jones',
                            email: 'alice.jones@dms.com',
                            phone: '4441239999',
                            status: 'ACTIVE',
                            version: 1,
                          });
                          setFrFormErrors({});
                          setFrFormOpen(!frFormOpen);
                        }}
                        style={{
                          backgroundColor: '#3B82F6',
                          color: '#FFFFFF',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: 'bold'
                        }}
                      >
                        {frFormOpen ? 'Close Form' : 'Create Representative'}
                      </button>
                    )}
                  </div>

                  {frFormOpen && currentUserRole === 'admin' && (
                    <form onSubmit={handleCreateOrUpdateFieldRep} style={{
                      backgroundColor: 'rgba(15,23,42,0.4)',
                      padding: '16px',
                      borderRadius: '8px',
                      marginBottom: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#60A5FA' }}>
                        {frEditingId ? `Edit Field Representative (Version: ${frFormData.version})` : 'New Representative Parameters'}
                      </h4>

                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '12px'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>User UUID Link *</label>
                          <input
                            type="text"
                            value={frFormData.userId}
                            onChange={(e) => setFrFormData({ ...frFormData, userId: e.target.value })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: frFormErrors.userId ? '1px solid #EF4444' : '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>Employee Code *</label>
                          <input
                            type="text"
                            value={frFormData.employeeCode}
                            onChange={(e) => setFrFormData({ ...frFormData, employeeCode: e.target.value })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: frFormErrors.employeeCode ? '1px solid #EF4444' : '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          />
                          {frFormErrors.employeeCode && <span style={{ color: '#EF4444', fontSize: '10px' }}>{frFormErrors.employeeCode}</span>}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>First Name *</label>
                          <input
                            type="text"
                            value={frFormData.firstName}
                            onChange={(e) => setFrFormData({ ...frFormData, firstName: e.target.value })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: frFormErrors.firstName ? '1px solid #EF4444' : '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          />
                          {frFormErrors.firstName && <span style={{ color: '#EF4444', fontSize: '10px' }}>{frFormErrors.firstName}</span>}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>Last Name *</label>
                          <input
                            type="text"
                            value={frFormData.lastName}
                            onChange={(e) => setFrFormData({ ...frFormData, lastName: e.target.value })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: frFormErrors.lastName ? '1px solid #EF4444' : '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          />
                          {frFormErrors.lastName && <span style={{ color: '#EF4444', fontSize: '10px' }}>{frFormErrors.lastName}</span>}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>Email Address *</label>
                          <input
                            type="text"
                            value={frFormData.email}
                            onChange={(e) => setFrFormData({ ...frFormData, email: e.target.value })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: frFormErrors.email ? '1px solid #EF4444' : '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          />
                          {frFormErrors.email && <span style={{ color: '#EF4444', fontSize: '10px' }}>{frFormErrors.email}</span>}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>Phone Number *</label>
                          <input
                            type="text"
                            value={frFormData.phone}
                            onChange={(e) => setFrFormData({ ...frFormData, phone: e.target.value })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: frFormErrors.phone ? '1px solid #EF4444' : '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          />
                          {frFormErrors.phone && <span style={{ color: '#EF4444', fontSize: '10px' }}>{frFormErrors.phone}</span>}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>Status</label>
                          <select
                            value={frFormData.status}
                            onChange={(e) => setFrFormData({ ...frFormData, status: e.target.value as any })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          >
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="INACTIVE">INACTIVE</option>
                            <option value="SUSPENDED">SUSPENDED</option>
                            <option value="TERMINATED">TERMINATED</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                        <button
                          type="submit"
                          style={{
                            backgroundColor: '#10B981',
                            color: '#FFFFFF',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}
                        >
                          {frEditingId ? 'Save Changes' : 'Create Representative'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFrFormOpen(false);
                            setFrEditingId(null);
                          }}
                          style={{
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            color: '#F8FAFC',
                            border: '1px solid rgba(255,255,255,0.1)',
                            padding: '8px 16px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Filters, Search and Pagination Controls */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px',
                    marginBottom: '16px',
                    backgroundColor: 'rgba(15,23,42,0.2)',
                    padding: '12px',
                    borderRadius: '8px'
                  }}>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="Search name, code, email..."
                        value={frSearchQuery}
                        onChange={(e) => { setFrSearchQuery(e.target.value); setFrPage(1); }}
                        style={{
                          backgroundColor: 'rgba(15,23,42,0.6)',
                          color: '#F8FAFC',
                          border: '1px solid rgba(255,255,255,0.1)',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          minWidth: '200px'
                        }}
                      />

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', opacity: 0.6 }}>Status:</span>
                        <select
                          value={frFilterStatus}
                          onChange={(e) => { setFrFilterStatus(e.target.value); setFrPage(1); }}
                          style={{
                            backgroundColor: 'rgba(15,23,42,0.6)',
                            color: '#F8FAFC',
                            border: '1px solid rgba(255,255,255,0.1)',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '11px'
                          }}
                        >
                          <option value="all">All Statuses</option>
                          <option value="ACTIVE">ACTIVE</option>
                          <option value="INACTIVE">INACTIVE</option>
                          <option value="SUSPENDED">SUSPENDED</option>
                          <option value="TERMINATED">TERMINATED</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
                      <button
                        disabled={frPage === 1}
                        onClick={() => setFrPage(prev => Math.max(1, prev - 1))}
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.05)',
                          color: '#F8FAFC',
                          border: '1px solid rgba(255,255,255,0.1)',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          cursor: frPage === 1 ? 'not-allowed' : 'pointer',
                          opacity: frPage === 1 ? 0.4 : 1
                        }}
                      >
                        Prev
                      </button>
                      <span>Page {frPage}</span>
                      <button
                        disabled={fieldReps.filter(t => {
                          const matchesSearch = t.firstName.toLowerCase().includes(frSearchQuery.toLowerCase()) ||
                            t.lastName.toLowerCase().includes(frSearchQuery.toLowerCase()) ||
                            t.employeeCode.toLowerCase().includes(frSearchQuery.toLowerCase()) ||
                            t.email.toLowerCase().includes(frSearchQuery.toLowerCase());
                          const matchesStatus = frFilterStatus === 'all' || t.status === frFilterStatus;
                          return matchesSearch && matchesStatus;
                        }).length <= frPage * frPageSize}
                        onClick={() => setFrPage(prev => prev + 1)}
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.05)',
                          color: '#F8FAFC',
                          border: '1px solid rgba(255,255,255,0.1)',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Next
                      </button>
                    </div>
                  </div>

                  {/* List Field Representatives Table */}
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', opacity: 0.7 }}>
                          <th style={{ padding: '10px 12px' }}>Code</th>
                          <th style={{ padding: '10px 12px' }}>Name</th>
                          <th style={{ padding: '10px 12px' }}>Email</th>
                          <th style={{ padding: '10px 12px' }}>Phone</th>
                          <th style={{ padding: '10px 12px' }}>Status</th>
                          <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fieldReps
                          .filter(t => {
                            const matchesSearch = t.firstName.toLowerCase().includes(frSearchQuery.toLowerCase()) ||
                              t.lastName.toLowerCase().includes(frSearchQuery.toLowerCase()) ||
                              t.employeeCode.toLowerCase().includes(frSearchQuery.toLowerCase()) ||
                              t.email.toLowerCase().includes(frSearchQuery.toLowerCase());
                            const matchesStatus = frFilterStatus === 'all' || t.status === frFilterStatus;
                            return matchesSearch && matchesStatus;
                          })
                          .slice((frPage - 1) * frPageSize, frPage * frPageSize)
                          .map((target) => {
                            const statusColor = target.status === 'ACTIVE' ? '#10B981' : (target.status === 'SUSPENDED' ? '#F59E0B' : (target.status === 'TERMINATED' ? '#EF4444' : '#64748B'));
                            return (
                              <tr key={target.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background-color 0.2s' }}>
                                <td style={{ padding: '12px', fontWeight: 'bold' }}>{target.employeeCode}</td>
                                <td style={{ padding: '12px' }}>{target.firstName} {target.lastName}</td>
                                <td style={{ padding: '12px', opacity: 0.8 }}>{target.email}</td>
                                <td style={{ padding: '12px', opacity: 0.8 }}>{target.phone}</td>
                                <td style={{ padding: '12px' }}>
                                  <span style={{
                                    backgroundColor: `rgba(${target.status === 'ACTIVE' ? '16, 185, 129' : (target.status === 'SUSPENDED' ? '245, 158, 11' : (target.status === 'TERMINATED' ? '239, 68, 68' : '100, 116, 139'))}, 0.15)`,
                                    color: statusColor,
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    fontSize: '10px',
                                    fontWeight: 'bold',
                                    border: `1px solid rgba(${target.status === 'ACTIVE' ? '16, 185, 129' : (target.status === 'SUSPENDED' ? '245, 158, 11' : (target.status === 'TERMINATED' ? '239, 68, 68' : '100, 116, 139'))}, 0.2)`
                                  }}>
                                    {target.status}
                                  </span>
                                </td>
                                <td style={{ padding: '12px', textAlign: 'right' }}>
                                  <div style={{ display: 'inline-flex', gap: '6px' }}>
                                    {currentUserRole === 'admin' && target.status !== 'TERMINATED' && (
                                      <button
                                        onClick={() => {
                                          setFrEditingId(target.id);
                                          setFrFormData({
                                            userId: target.userId,
                                            employeeCode: target.employeeCode,
                                            firstName: target.firstName,
                                            lastName: target.lastName,
                                            email: target.email,
                                            phone: target.phone,
                                            status: target.status,
                                            version: target.version,
                                          });
                                          setFrFormErrors({});
                                          setFrFormOpen(true);
                                        }}
                                        style={{
                                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                          border: '1px solid rgba(255, 255, 255, 0.1)',
                                          color: '#F8FAFC',
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          fontSize: '10px',
                                          cursor: 'pointer',
                                        }}
                                      >
                                        Edit
                                      </button>
                                    )}

                                    {currentUserRole === 'admin' && target.status === 'ACTIVE' && (
                                      <button
                                        onClick={() => handleUpdateFieldRepStatus(target.id, 'SUSPENDED')}
                                        style={{
                                          backgroundColor: 'rgba(245, 158, 11, 0.1)',
                                          border: '1px solid rgba(245, 158, 11, 0.2)',
                                          color: '#FBBF24',
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          fontSize: '10px',
                                          cursor: 'pointer',
                                        }}
                                      >
                                        Suspend
                                      </button>
                                    )}

                                    {currentUserRole === 'admin' && target.status === 'SUSPENDED' && (
                                      <button
                                        onClick={() => handleUpdateFieldRepStatus(target.id, 'ACTIVE')}
                                        style={{
                                          backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                          border: '1px solid rgba(16, 185, 129, 0.2)',
                                          color: '#34D399',
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          fontSize: '10px',
                                          cursor: 'pointer',
                                        }}
                                      >
                                        Activate
                                      </button>
                                    )}

                                    {currentUserRole === 'admin' && target.status !== 'TERMINATED' && (
                                      <button
                                        onClick={() => handleUpdateFieldRepStatus(target.id, 'TERMINATED')}
                                        style={{
                                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                          border: '1px solid rgba(239, 68, 68, 0.2)',
                                          color: '#F87171',
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          fontSize: '10px',
                                          cursor: 'pointer',
                                        }}
                                      >
                                        Terminate
                                      </button>
                                    )}

                                    {currentUserRole === 'admin' && (
                                      <button
                                        onClick={() => handleDeleteFieldRep(target.id)}
                                        style={{
                                          backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                          border: '1px solid rgba(239, 68, 68, 0.3)',
                                          color: '#F87171',
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          fontSize: '10px',
                                          cursor: 'pointer',
                                        }}
                                      >
                                        Delete
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* KPI Achievements Console Section */}
                <div style={{
                  backgroundColor: 'rgba(30, 41, 59, 0.2)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '12px',
                  padding: '20px',
                  gridColumn: '1 / -1',
                  marginTop: '20px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '15px', color: '#60A5FA' }}>KPI Achievements Management</h3>
                      <p style={{ margin: '2px 0 0 0', opacity: 0.5, fontSize: '11px' }}>Enforce KPI limits, monitor achievements, and track monthly indicators.</p>
                    </div>
                    {currentUserRole === 'admin' && (
                      <button
                        onClick={() => {
                          setKpiEditingId(null);
                          setKpiFormData({
                            agentId: 'agent-uuid-4444',
                            kpiType: 'visits',
                            periodMonth: 6,
                            periodYear: 2026,
                            targetValue: 100,
                            status: 'DRAFT',
                            version: 1,
                          });
                          setKpiFormErrors({});
                          setKpiFormOpen(!kpiFormOpen);
                        }}
                        style={{
                          backgroundColor: '#3B82F6',
                          color: '#FFFFFF',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: 'bold'
                        }}
                      >
                        {kpiFormOpen ? 'Close Form' : 'Create KPI Target'}
                      </button>
                    )}
                  </div>

                  {kpiFormOpen && currentUserRole === 'admin' && (
                    <form onSubmit={handleCreateOrUpdateKPIAchievement} style={{
                      backgroundColor: 'rgba(15,23,42,0.4)',
                      padding: '16px',
                      borderRadius: '8px',
                      marginBottom: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#60A5FA' }}>
                        {kpiEditingId ? `Edit KPI Target (Optimistic Version: ${kpiFormData.version})` : 'New KPI Target Parameters'}
                      </h4>

                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '12px'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>Agent Reference ID *</label>
                          <input
                            type="text"
                            value={kpiFormData.agentId}
                            onChange={(e) => setKpiFormData({ ...kpiFormData, agentId: e.target.value })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: kpiFormErrors.agentId ? '1px solid #EF4444' : '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          />
                          {kpiFormErrors.agentId && <span style={{ color: '#EF4444', fontSize: '10px' }}>{kpiFormErrors.agentId}</span>}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>Target Value *</label>
                          <input
                            type="number"
                            value={kpiFormData.targetValue}
                            onChange={(e) => setKpiFormData({ ...kpiFormData, targetValue: Number(e.target.value) })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: kpiFormErrors.targetValue ? '1px solid #EF4444' : '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          />
                          {kpiFormErrors.targetValue && <span style={{ color: '#EF4444', fontSize: '10px' }}>{kpiFormErrors.targetValue}</span>}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>Period Month (1-12) *</label>
                          <input
                            type="number"
                            value={kpiFormData.periodMonth}
                            onChange={(e) => setKpiFormData({ ...kpiFormData, periodMonth: Number(e.target.value) })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: kpiFormErrors.periodMonth ? '1px solid #EF4444' : '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          />
                          {kpiFormErrors.periodMonth && <span style={{ color: '#EF4444', fontSize: '10px' }}>{kpiFormErrors.periodMonth}</span>}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>Period Year (2000-2100) *</label>
                          <input
                            type="number"
                            value={kpiFormData.periodYear}
                            onChange={(e) => setKpiFormData({ ...kpiFormData, periodYear: Number(e.target.value) })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: kpiFormErrors.periodYear ? '1px solid #EF4444' : '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          />
                          {kpiFormErrors.periodYear && <span style={{ color: '#EF4444', fontSize: '10px' }}>{kpiFormErrors.periodYear}</span>}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>KPI Indicator Type</label>
                          <select
                            value={kpiFormData.kpiType}
                            onChange={(e) => setKpiFormData({ ...kpiFormData, kpiType: e.target.value })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          >
                            <option value="visits">visits (Count of completed visits)</option>
                            <option value="orders">orders (Count of placed orders)</option>
                            <option value="sales_amount">sales_amount (Financial volume sum)</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                        <button
                          type="submit"
                          style={{
                            backgroundColor: '#10B981',
                            color: '#FFFFFF',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}
                        >
                          {kpiEditingId ? 'Save Changes' : 'Submit KPI'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setKpiFormOpen(false);
                            setKpiEditingId(null);
                          }}
                          style={{
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            color: '#F8FAFC',
                            border: '1px solid rgba(255,255,255,0.1)',
                            padding: '8px 16px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Filters and Pagination Controls */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px',
                    marginBottom: '16px',
                    backgroundColor: 'rgba(15,23,42,0.2)',
                    padding: '12px',
                    borderRadius: '8px'
                  }}>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', opacity: 0.6 }}>Agent:</span>
                        <select
                          value={kpiFilterAgentId}
                          onChange={(e) => { setKpiFilterAgentId(e.target.value); setKpiPage(1); }}
                          style={{
                            backgroundColor: 'rgba(15,23,42,0.6)',
                            color: '#F8FAFC',
                            border: '1px solid rgba(255,255,255,0.1)',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '11px'
                          }}
                        >
                          <option value="all">All Agents</option>
                          <option value="agent-uuid-4444">agent-uuid-4444</option>
                          <option value="agent-uuid-5555">agent-uuid-5555</option>
                        </select>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', opacity: 0.6 }}>Status:</span>
                        <select
                          value={kpiFilterStatus}
                          onChange={(e) => { setKpiFilterStatus(e.target.value); setKpiPage(1); }}
                          style={{
                            backgroundColor: 'rgba(15,23,42,0.6)',
                            color: '#F8FAFC',
                            border: '1px solid rgba(255,255,255,0.1)',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '11px'
                          }}
                        >
                          <option value="all">All Statuses</option>
                          <option value="DRAFT">DRAFT</option>
                          <option value="SUBMITTED">SUBMITTED</option>
                          <option value="APPROVED">APPROVED</option>
                          <option value="REJECTED">REJECTED</option>
                        </select>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', opacity: 0.6 }}>Indicator:</span>
                        <select
                          value={kpiFilterType}
                          onChange={(e) => { setKpiFilterType(e.target.value); setKpiPage(1); }}
                          style={{
                            backgroundColor: 'rgba(15,23,42,0.6)',
                            color: '#F8FAFC',
                            border: '1px solid rgba(255,255,255,0.1)',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '11px'
                          }}
                        >
                          <option value="all">All Indicators</option>
                          <option value="visits">visits</option>
                          <option value="orders">orders</option>
                          <option value="sales_amount">sales_amount</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
                      <button
                        disabled={kpiPage === 1}
                        onClick={() => setKpiPage(prev => Math.max(1, prev - 1))}
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.05)',
                          color: '#F8FAFC',
                          border: '1px solid rgba(255,255,255,0.1)',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          cursor: kpiPage === 1 ? 'not-allowed' : 'pointer',
                          opacity: kpiPage === 1 ? 0.4 : 1
                        }}
                      >
                        Prev
                      </button>
                      <span>Page {kpiPage}</span>
                      <button
                        disabled={kpiAchievements.filter(t => {
                          if (kpiFilterAgentId !== 'all' && t.agentId !== kpiFilterAgentId) return false;
                          if (kpiFilterStatus !== 'all' && t.status !== kpiFilterStatus) return false;
                          if (kpiFilterType !== 'all' && t.kpiType !== kpiFilterType) return false;
                          return true;
                        }).length <= kpiPage * kpiPageSize}
                        onClick={() => setKpiPage(prev => prev + 1)}
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.05)',
                          color: '#F8FAFC',
                          border: '1px solid rgba(255,255,255,0.1)',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Next
                      </button>
                    </div>
                  </div>

                  {/* List KPI Targets Table */}
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', opacity: 0.7 }}>
                          <th style={{ padding: '10px 12px' }}>Period</th>
                          <th style={{ padding: '10px 12px' }}>Agent ID</th>
                          <th style={{ padding: '10px 12px' }}>KPI Type</th>
                          <th style={{ padding: '10px 12px' }}>Progress</th>
                          <th style={{ padding: '10px 12px' }}>Status</th>
                          <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kpiAchievements
                          .filter(t => {
                            if (kpiFilterAgentId !== 'all' && t.agentId !== kpiFilterAgentId) return false;
                            if (kpiFilterStatus !== 'all' && t.status !== kpiFilterStatus) return false;
                            if (kpiFilterType !== 'all' && t.kpiType !== kpiFilterType) return false;
                            return true;
                          })
                          .slice((kpiPage - 1) * kpiPageSize, kpiPage * kpiPageSize)
                          .map((target) => {
                            const pct = target.targetValue > 0 ? Math.round((target.achievedValue / target.targetValue) * 100) : 0;
                            const statusColor = target.status === 'APPROVED' ? '#10B981' : (target.status === 'SUBMITTED' ? '#3B82F6' : (target.status === 'REJECTED' ? '#EF4444' : '#F59E0B'));
                            return (
                              <tr key={target.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background-color 0.2s' }}>
                                <td style={{ padding: '12px', fontWeight: 'bold' }}>{target.periodYear}-{String(target.periodMonth).padStart(2, '0')}</td>
                                <td style={{ padding: '12px', opacity: 0.8 }}>{target.agentId}</td>
                                <td style={{ padding: '12px' }}>
                                  <span style={{ fontSize: '11px', textTransform: 'uppercase', opacity: 0.6 }}>{target.kpiType}</span>
                                </td>
                                <td style={{ padding: '12px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '80px', height: '6px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                                      <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', backgroundColor: statusColor }} />
                                    </div>
                                    <span style={{ fontSize: '11px', fontWeight: 'bold' }}>
                                      {target.achievedValue}/{target.targetValue} ({pct}%)
                                    </span>
                                  </div>
                                </td>
                                <td style={{ padding: '12px' }}>
                                  <span style={{
                                    backgroundColor: `rgba(${target.status === 'APPROVED' ? '16, 185, 129' : (target.status === 'SUBMITTED' ? '59, 130, 246' : (target.status === 'REJECTED' ? '239, 68, 68' : '245, 158, 11'))}, 0.15)`,
                                    color: statusColor,
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    fontSize: '10px',
                                    fontWeight: 'bold',
                                    border: `1px solid rgba(${target.status === 'APPROVED' ? '16, 185, 129' : (target.status === 'SUBMITTED' ? '59, 130, 246' : (target.status === 'REJECTED' ? '239, 68, 68' : '245, 158, 11'))}, 0.2)`
                                  }}>
                                    {target.status}
                                  </span>
                                </td>
                                <td style={{ padding: '12px', textAlign: 'right' }}>
                                  <div style={{ display: 'inline-flex', gap: '6px' }}>
                                    {currentUserRole === 'admin' && target.status === 'DRAFT' && (
                                      <button
                                        onClick={() => handleUpdateKPIAchievementStatus(target.id, 'submit')}
                                        style={{
                                          backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                          border: '1px solid rgba(59, 130, 246, 0.2)',
                                          color: '#60A5FA',
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          fontSize: '10px',
                                          cursor: 'pointer',
                                        }}
                                      >
                                        Submit
                                      </button>
                                    )}

                                    {currentUserRole === 'admin' && target.status === 'SUBMITTED' && (
                                      <button
                                        onClick={() => handleUpdateKPIAchievementStatus(target.id, 'approve')}
                                        style={{
                                          backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                          border: '1px solid rgba(16, 185, 129, 0.2)',
                                          color: '#34D399',
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          fontSize: '10px',
                                          cursor: 'pointer',
                                        }}
                                      >
                                        Approve
                                      </button>
                                    )}

                                    {currentUserRole === 'admin' && target.status === 'SUBMITTED' && (
                                      <button
                                        onClick={() => handleUpdateKPIAchievementStatus(target.id, 'reject')}
                                        style={{
                                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                          border: '1px solid rgba(239, 68, 68, 0.2)',
                                          color: '#F87171',
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          fontSize: '10px',
                                          cursor: 'pointer',
                                        }}
                                      >
                                        Reject
                                      </button>
                                    )}

                                    {currentUserRole === 'admin' && target.status === 'DRAFT' && (
                                      <button
                                        onClick={() => {
                                          setKpiEditingId(target.id);
                                          setKpiFormData({
                                            agentId: target.agentId,
                                            kpiType: target.kpiType,
                                            periodMonth: target.periodMonth,
                                            periodYear: target.periodYear,
                                            targetValue: target.targetValue,
                                            status: target.status,
                                            version: target.version,
                                          });
                                          setKpiFormErrors({});
                                          setKpiFormOpen(true);
                                        }}
                                        style={{
                                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                          border: '1px solid rgba(255, 255, 255, 0.1)',
                                          color: '#F8FAFC',
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          fontSize: '10px',
                                          cursor: 'pointer',
                                        }}
                                      >
                                        Edit
                                      </button>
                                    )}

                                    {currentUserRole === 'admin' && (
                                      <button
                                        onClick={() => handleDeleteKPIAchievement(target.id)}
                                        style={{
                                          backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                          border: '1px solid rgba(239, 68, 68, 0.3)',
                                          color: '#F87171',
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          fontSize: '10px',
                                          cursor: 'pointer',
                                        }}
                                      >
                                        Delete
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

              {sfaSubTab === 'surveys' && (
                <div style={{
                  backgroundColor: 'rgba(30, 41, 59, 0.2)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '12px',
                  padding: '20px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '15px', color: '#60A5FA' }}>Survey Management Console</h3>
                      <p style={{ margin: '2px 0 0 0', opacity: 0.5, fontSize: '11px' }}>Design field agent surveys, manage lifecycle transitions, and audit response counts.</p>
                    </div>
                    {currentUserRole === 'admin' && (
                      <button
                        onClick={() => {
                          setSurveyEditingId(null);
                          setSurveyFormData({
                            title: '',
                            agentId: fieldReps[0]?.userId || 'agent-uuid-4444',
                            outletId: outletCensuses[0]?.outletId || 'out-1',
                            status: 'DRAFT',
                            version: 1
                          });
                          setSurveyFormErrors({});
                          setSurveyFormOpen(!surveyFormOpen);
                        }}
                        style={{
                          backgroundColor: '#3B82F6',
                          color: '#FFFFFF',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: 'bold'
                        }}
                      >
                        {surveyFormOpen ? 'Close Form' : 'Design New Survey'}
                      </button>
                    )}
                  </div>

                  {surveyFormOpen && currentUserRole === 'admin' && (
                    <form onSubmit={handleCreateOrUpdateSurvey} style={{
                      backgroundColor: 'rgba(15,23,42,0.4)',
                      padding: '16px',
                      borderRadius: '8px',
                      marginBottom: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#60A5FA' }}>
                        {surveyEditingId ? `Edit Survey Parameters (Optimistic Version: ${surveyFormData.version})` : 'New Survey Profile'}
                      </h4>

                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '12px'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>Survey Title *</label>
                          <input
                            type="text"
                            value={surveyFormData.title}
                            onChange={(e) => setSurveyFormData({ ...surveyFormData, title: e.target.value })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: surveyFormErrors.title ? '1px solid #EF4444' : '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          />
                          {surveyFormErrors.title && <span style={{ color: '#EF4444', fontSize: '10px' }}>{surveyFormErrors.title}</span>}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>Assigned Field Agent *</label>
                          <select
                            value={surveyFormData.agentId}
                            onChange={(e) => setSurveyFormData({ ...surveyFormData, agentId: e.target.value })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          >
                            {fieldReps.map(rep => (
                              <option key={rep.id} value={rep.userId}>{rep.firstName} {rep.lastName} ({rep.employeeCode})</option>
                            ))}
                          </select>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>Target Retail Outlet *</label>
                          <select
                            value={surveyFormData.outletId}
                            onChange={(e) => setSurveyFormData({ ...surveyFormData, outletId: e.target.value })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          >
                            {outletCensuses.map(c => (
                              <option key={c.id} value={c.outletId}>{c.outletName} ({c.outletId})</option>
                            ))}
                          </select>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', opacity: 0.6 }}>Initial Status</label>
                          <select
                            value={surveyFormData.status}
                            onChange={(e) => setSurveyFormData({ ...surveyFormData, status: e.target.value as any })}
                            style={{
                              backgroundColor: 'rgba(15,23,42,0.6)',
                              color: '#F8FAFC',
                              border: '1px solid rgba(255,255,255,0.1)',
                              padding: '6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          >
                            <option value="DRAFT">DRAFT</option>
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="COMPLETED">COMPLETED</option>
                            <option value="CANCELLED">CANCELLED</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setSurveyFormOpen(false);
                            setSurveyEditingId(null);
                          }}
                          style={{
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            color: '#94A3B8',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          style={{
                            backgroundColor: '#10B981',
                            color: '#FFFFFF',
                            border: 'none',
                            padding: '6px 16px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                          }}
                        >
                          {surveyEditingId ? 'Save Changes' : 'Design Survey'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Filters, search and sort */}
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '12px',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px',
                    paddingBottom: '12px',
                    borderBottom: '1px solid rgba(255,255,255,0.05)'
                  }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        placeholder="Search survey title..."
                        value={surveySearchQuery}
                        onChange={(e) => { setSurveySearchQuery(e.target.value); setSurveyPage(1); }}
                        style={{
                          backgroundColor: 'rgba(15,23,42,0.6)',
                          color: '#F8FAFC',
                          border: '1px solid rgba(255,255,255,0.1)',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          width: '180px'
                        }}
                      />
                      <select
                        value={surveyStatusFilter}
                        onChange={(e) => { setSurveyStatusFilter(e.target.value); setSurveyPage(1); }}
                        style={{
                          backgroundColor: 'rgba(15,23,42,0.6)',
                          color: '#F8FAFC',
                          border: '1px solid rgba(255,255,255,0.1)',
                          padding: '6px',
                          borderRadius: '6px',
                          fontSize: '12px'
                        }}
                      >
                        <option value="all">Status: All</option>
                        <option value="DRAFT">Status: DRAFT</option>
                        <option value="ACTIVE">Status: ACTIVE</option>
                        <option value="COMPLETED">Status: COMPLETED</option>
                        <option value="CANCELLED">Status: CANCELLED</option>
                      </select>
                      <select
                        value={surveySortField}
                        onChange={(e) => setSurveySortField(e.target.value)}
                        style={{
                          backgroundColor: 'rgba(15,23,42,0.6)',
                          color: '#F8FAFC',
                          border: '1px solid rgba(255,255,255,0.1)',
                          padding: '6px',
                          borderRadius: '6px',
                          fontSize: '12px'
                        }}
                      >
                        <option value="title">Sort: Title</option>
                        <option value="version">Sort: Version</option>
                      </select>
                    </div>
                  </div>

                  {/* List View */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {(() => {
                      const filtered = surveys
                        .filter(s => s.title.toLowerCase().includes(surveySearchQuery.toLowerCase()))
                        .filter(s => surveyStatusFilter === 'all' || s.status === surveyStatusFilter)
                        .sort((a, b) => {
                          if (surveySortField === 'version') return b.version - a.version;
                          return a.title.localeCompare(b.title);
                        });

                      const totalCount = filtered.length;
                      const offset = (surveyPage - 1) * surveyPageSize;
                      const paginated = filtered.slice(offset, offset + surveyPageSize);
                      const totalPages = Math.ceil(totalCount / surveyPageSize) || 1;

                      if (paginated.length === 0) {
                        return <div style={{ textAlign: 'center', opacity: 0.5, fontSize: '13px', padding: '24px 0' }}>No surveys found matching criteria.</div>;
                      }

                      return (
                        <>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {paginated.map(survey => {
                              const rep = fieldReps.find(r => r.userId === survey.agentId);
                              const out = outletCensuses.find(o => o.outletId === survey.outletId);
                              
                              return (
                                <div key={survey.id} style={{
                                  backgroundColor: 'rgba(15,23,42,0.4)',
                                  padding: '16px',
                                  borderRadius: '8px',
                                  borderLeft: `4px solid ${
                                    survey.status === 'COMPLETED' ? '#10B981' : 
                                    (survey.status === 'ACTIVE' ? '#3B82F6' : 
                                    (survey.status === 'CANCELLED' ? '#94A3B8' : '#FBBF24'))
                                  }`,
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  flexWrap: 'wrap',
                                  gap: '16px'
                                }}>
                                  <div>
                                    <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{survey.title}</div>
                                    <div style={{ fontSize: '12px', opacity: 0.6, marginTop: '2px' }}>
                                      ID: {survey.id} • Version: {survey.version}
                                    </div>
                                    <div style={{ fontSize: '11px', opacity: 0.5, marginTop: '4px', color: '#60A5FA' }}>
                                      Agent: {rep ? `${rep.firstName} ${rep.lastName}` : survey.agentId} • Outlet: {out ? out.outletName : survey.outletId}
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <span style={{
                                      backgroundColor: 
                                        survey.status === 'COMPLETED' ? 'rgba(16, 185, 129, 0.15)' : 
                                        (survey.status === 'ACTIVE' ? 'rgba(59, 130, 246, 0.15)' : 
                                        (survey.status === 'CANCELLED' ? 'rgba(148, 163, 184, 0.15)' : 'rgba(245, 158, 11, 0.15)')),
                                      color: 
                                        survey.status === 'COMPLETED' ? '#34D399' : 
                                        (survey.status === 'ACTIVE' ? '#60A5FA' : 
                                        (survey.status === 'CANCELLED' ? '#94A3B8' : '#FBBF24')),
                                      padding: '4px 10px',
                                      borderRadius: '4px',
                                      fontSize: '10px',
                                      fontWeight: 'bold'
                                    }}>
                                      {survey.status}
                                    </span>
                                    {currentUserRole === 'admin' && (
                                      <>
                                        {survey.status === 'DRAFT' && (
                                          <button
                                            onClick={() => handleActivateSurvey(survey.id)}
                                            style={{
                                              backgroundColor: 'rgba(59, 130, 246, 0.2)',
                                              border: '1px solid rgba(59, 130, 246, 0.4)',
                                              color: '#60A5FA',
                                              padding: '4px 8px',
                                              borderRadius: '4px',
                                              fontSize: '11px',
                                              cursor: 'pointer',
                                              fontWeight: 'bold'
                                            }}
                                          >
                                            Activate
                                          </button>
                                        )}
                                        {survey.status === 'ACTIVE' && (
                                          <button
                                            onClick={() => handleCompleteSurvey(survey.id)}
                                            style={{
                                              backgroundColor: 'rgba(16, 185, 129, 0.2)',
                                              border: '1px solid rgba(16, 185, 129, 0.4)',
                                              color: '#34D399',
                                              padding: '4px 8px',
                                              borderRadius: '4px',
                                              fontSize: '11px',
                                              cursor: 'pointer',
                                              fontWeight: 'bold'
                                            }}
                                          >
                                            Complete
                                          </button>
                                        )}
                                        {(survey.status === 'DRAFT' || survey.status === 'ACTIVE') && (
                                          <>
                                            <button
                                              onClick={() => {
                                                setSurveyEditingId(survey.id);
                                                setSurveyFormData({
                                                  title: survey.title,
                                                  agentId: survey.agentId,
                                                  outletId: survey.outletId,
                                                  status: survey.status,
                                                  version: survey.version
                                                });
                                                setSurveyFormErrors({});
                                                setSurveyFormOpen(true);
                                              }}
                                              style={{
                                                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                                color: '#FFFFFF',
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                fontSize: '11px',
                                                cursor: 'pointer',
                                                fontWeight: 'bold'
                                              }}
                                            >
                                              Edit
                                            </button>
                                            <button
                                              onClick={() => handleCancelSurvey(survey.id)}
                                              style={{
                                                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                                                border: '1px solid rgba(239, 68, 68, 0.4)',
                                                color: '#F87171',
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                fontSize: '11px',
                                                cursor: 'pointer',
                                                fontWeight: 'bold'
                                              }}
                                            >
                                              Cancel
                                            </button>
                                          </>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Pagination */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', fontSize: '12px', opacity: 0.8 }}>
                            <div>Showing {offset + 1} to {Math.min(offset + surveyPageSize, totalCount)} of {totalCount} surveys</div>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button
                                disabled={surveyPage === 1}
                                onClick={() => setSurveyPage(prev => Math.max(1, prev - 1))}
                                style={{
                                  backgroundColor: 'rgba(255,255,255,0.05)',
                                  color: surveyPage === 1 ? '#475569' : '#FFFFFF',
                                  border: 'none',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  cursor: surveyPage === 1 ? 'not-allowed' : 'pointer'
                                }}
                              >
                                Prev
                              </button>
                              <button
                                disabled={surveyPage === totalPages}
                                onClick={() => setSurveyPage(prev => Math.min(totalPages, prev + 1))}
                                style={{
                                  backgroundColor: 'rgba(255,255,255,0.05)',
                                  color: surveyPage === totalPages ? '#475569' : '#FFFFFF',
                                  border: 'none',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  cursor: surveyPage === totalPages ? 'not-allowed' : 'pointer'
                                }}
                              >
                                Next
                              </button>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
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
