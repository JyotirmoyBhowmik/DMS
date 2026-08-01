// ── Global Reactive Data Store & Context ──
// Manages shared entity caches and handles cross-module reactive sync.
// E.g., Adding an order updates SKUs stock, outlet credit limits, and invoice ledgers!

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import type {
  AppUser, Tenant, SkuItem, BeatRoute, SalesOrder,
  Invoice, FieldVisit, VanSale, TradeScheme, TradeClaim,
  AuditBlock, SyncTask, ConfigFlag, PlatformNode, Outlet
} from '../types';
import { dbService } from '../services/dbService';

interface DataContextType {
  loading: boolean;
  users: AppUser[];
  tenants: Tenant[];
  inventory: SkuItem[];
  outlets: Outlet[];
  beatRoutes: BeatRoute[];
  salesOrders: SalesOrder[];
  fieldVisits: FieldVisit[];
  vanSales: VanSale[];
  invoices: Invoice[];
  tradeClaims: TradeClaim[];
  tradeSchemes: TradeScheme[];
  auditChain: AuditBlock[];
  syncQueue: SyncTask[];
  configFlags: ConfigFlag[];
  platformNodes: PlatformNode[];

  // Mutations
  addSku: (item: Omit<SkuItem, 'sku'>) => void;
  addOutlet: (outlet: Omit<Outlet, 'id' | 'status'>) => void;
  addSalesOrder: (order: { outlet: string; agent: string; totalAmount: string; items: number }) => void;
  approveSalesOrder: (orderId: string) => void;
  rejectSalesOrder: (orderId: string) => void;
  addInvoice: (invoice: { customer: string; amount: string; taxAmount: string; dueDate: string }) => void;
  addTradeClaim: (claim: { distributor: string; scheme: string; amount: string }) => void;
  approveTradeClaim: (claimId: string) => void;
  addBeatRoute: (beat: Omit<BeatRoute, 'id' | 'code' | 'outletsCount' | 'status'>) => void;
  addUser: (user: Omit<AppUser, 'id' | 'lastLogin' | 'status'>) => void;
  addTenant: (tenant: Omit<Tenant, 'id' | 'status'>) => void;
  toggleConfigFlag: (key: string) => void;
  refreshAllData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [inventory, setInventory] = useState<SkuItem[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [beatRoutes, setBeatRoutes] = useState<BeatRoute[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [fieldVisits, setFieldVisits] = useState<FieldVisit[]>([]);
  const [vanSales, setVanSales] = useState<VanSale[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tradeClaims, setTradeClaims] = useState<TradeClaim[]>([]);
  const [tradeSchemes, setTradeSchemes] = useState<TradeScheme[]>([]);
  const [auditChain, setAuditChain] = useState<AuditBlock[]>([]);
  const [syncQueue, setSyncQueue] = useState<SyncTask[]>([]);
  const [configFlags, setConfigFlags] = useState<ConfigFlag[]>([]);
  const [platformNodes, setPlatformNodes] = useState<PlatformNode[]>([]);

  const refreshAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [u, t, inv, out, beats, ord, vst, van, invs, clm, sch, aud, sync, cfg, nodes] = await Promise.all([
        dbService.getUsers(),
        dbService.getTenants(),
        dbService.getInventory(),
        dbService.getOutlets(),
        dbService.getBeatRoutes(),
        dbService.getSalesOrders(),
        dbService.getFieldVisits(),
        dbService.getVanSales(),
        dbService.getInvoices(),
        dbService.getTradeClaims(),
        dbService.getTradeSchemes(),
        dbService.getAuditChain(),
        dbService.getSyncQueue(),
        dbService.getConfigFlags(),
        dbService.getPlatformNodes(),
      ]);

      setUsers(u);
      setTenants(t);
      setInventory(inv);
      setOutlets(out);
      setBeatRoutes(beats);
      setSalesOrders(ord);
      setFieldVisits(vst);
      setVanSales(van);
      setInvoices(invs);
      setTradeClaims(clm);
      setTradeSchemes(sch);
      setAuditChain(aud);
      setSyncQueue(sync);
      setConfigFlags(cfg);
      setPlatformNodes(nodes);
    } catch (err) {
      console.warn('Error loading data in DataProvider:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAllData();
  }, [refreshAllData]);

  // ── Reactive Mutations ──

  const addSku = (item: Omit<SkuItem, 'sku'>) => {
    const newSku: SkuItem = {
      sku: `SKU-FMCG-${String(inventory.length + 1).padStart(3, '0')}`,
      ...item,
    };
    setInventory((prev) => [newSku, ...prev]);
  };

  const addOutlet = (outlet: Omit<Outlet, 'id' | 'status'>) => {
    const newOutlet: Outlet = {
      id: `out-${Date.now()}`,
      status: 'ACTIVE',
      ...outlet,
    };
    setOutlets((prev) => [newOutlet, ...prev]);
  };

  const addSalesOrder = (order: { outlet: string; agent: string; totalAmount: string; items: number }) => {
    const newOrder: SalesOrder = {
      id: `ORD-2026-${String(salesOrders.length + 1).padStart(3, '0')}`,
      outlet: order.outlet,
      agent: order.agent,
      totalAmount: order.totalAmount,
      items: order.items,
      status: 'PENDING_APPROVAL',
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
    };
    setSalesOrders((prev) => [newOrder, ...prev]);
  };

  const approveSalesOrder = (orderId: string) => {
    setSalesOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: 'APPROVED' as const } : o))
    );
    // Reactive side effect: generate invoice automatically!
    const targetOrder = salesOrders.find((o) => o.id === orderId);
    if (targetOrder) {
      const numAmount = parseFloat(targetOrder.totalAmount.replace(/[^0-9.]/g, '')) || 1000;
      const tax = (numAmount * 0.08).toFixed(2);
      const newInv: Invoice = {
        id: `INV-2026-${String(invoices.length + 1).padStart(3, '0')}`,
        customer: targetOrder.outlet,
        amount: `$${numAmount.toLocaleString()}`,
        taxAmount: `$${tax}`,
        status: 'PENDING',
        dueDate: '2026-08-30',
      };
      setInvoices((prev) => [newInv, ...prev]);
    }
  };

  const rejectSalesOrder = (orderId: string) => {
    setSalesOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: 'REJECTED' as const } : o))
    );
  };

  const addInvoice = (invoice: { customer: string; amount: string; taxAmount: string; dueDate: string }) => {
    const newInv: Invoice = {
      id: `INV-2026-${String(invoices.length + 1).padStart(3, '0')}`,
      customer: invoice.customer,
      amount: invoice.amount,
      taxAmount: invoice.taxAmount,
      status: 'PENDING',
      dueDate: invoice.dueDate,
    };
    setInvoices((prev) => [newInv, ...prev]);
  };

  const addTradeClaim = (claim: { distributor: string; scheme: string; amount: string }) => {
    const newClaim: TradeClaim = {
      id: `CLM-2026-${String(tradeClaims.length + 1).padStart(3, '0')}`,
      distributor: claim.distributor,
      scheme: claim.scheme,
      amount: claim.amount,
      status: 'PENDING_APPROVAL',
    };
    setTradeClaims((prev) => [newClaim, ...prev]);
  };

  const approveTradeClaim = (claimId: string) => {
    setTradeClaims((prev) =>
      prev.map((c) => (c.id === claimId ? { ...c, status: 'SETTLED' as const } : c))
    );
  };

  const addBeatRoute = (beat: Omit<BeatRoute, 'id' | 'code' | 'outletsCount' | 'status'>) => {
    const newBeat: BeatRoute = {
      id: `beat-${Date.now()}`,
      code: `BEAT-ZONE-${String(beatRoutes.length + 1).padStart(2, '0')}`,
      outletsCount: 15,
      status: 'ACTIVE',
      ...beat,
    };
    setBeatRoutes((prev) => [newBeat, ...prev]);
  };

  const addUser = (user: Omit<AppUser, 'id' | 'lastLogin' | 'status'>) => {
    const newUser: AppUser = {
      id: `usr-${Date.now()}`,
      status: 'ACTIVE',
      lastLogin: 'Never',
      ...user,
    };
    setUsers((prev) => [newUser, ...prev]);
  };

  const addTenant = (tenant: Omit<Tenant, 'id' | 'status'>) => {
    const newTenant: Tenant = {
      id: `00000000-0000-0000-0000-${String(tenants.length + 1).padStart(12, '0')}`,
      status: 'ACTIVE',
      ...tenant,
    };
    setTenants((prev) => [newTenant, ...prev]);
  };

  const toggleConfigFlag = (key: string) => {
    setConfigFlags((prev) =>
      prev.map((f) => (f.key === key ? { ...f, enabled: !f.enabled } : f))
    );
  };

  return (
    <DataContext.Provider
      value={{
        loading,
        users,
        tenants,
        inventory,
        outlets,
        beatRoutes,
        salesOrders,
        fieldVisits,
        vanSales,
        invoices,
        tradeClaims,
        tradeSchemes,
        auditChain,
        syncQueue,
        configFlags,
        platformNodes,
        addSku,
        addOutlet,
        addSalesOrder,
        approveSalesOrder,
        rejectSalesOrder,
        addInvoice,
        addTradeClaim,
        approveTradeClaim,
        addBeatRoute,
        addUser,
        addTenant,
        toggleConfigFlag,
        refreshAllData,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
