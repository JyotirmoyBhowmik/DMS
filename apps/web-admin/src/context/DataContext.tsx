// ── Global Reactive Data Store & Context ──
// Manages shared entity caches, handles cross-module reactive sync,
// persists all user mutations to localStorage AND syncs to the DB API gateway.

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import type {
  AppUser, Tenant, SkuItem, BeatRoute, SalesOrder,
  Invoice, FieldVisit, VanSale, TradeScheme, TradeClaim,
  AuditBlock, SyncTask, ConfigFlag, PlatformNode, Outlet
} from '../types';
import { dbService } from '../services/dbService';

// ── Local Storage Helper Functions ──
const getStored = <T,>(key: string, fallback: T[]): T[] => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const setStored = <T,>(key: string, data: T[]) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.warn(`[DataContext] Local storage quota exceeded for ${key}:`, err);
  }
};

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

const LS_KEYS = {
  USERS: 'dms_store_users',
  TENANTS: 'dms_store_tenants',
  INVENTORY: 'dms_store_inventory',
  OUTLETS: 'dms_store_outlets',
  BEATS: 'dms_store_beats',
  ORDERS: 'dms_store_orders',
  INVOICES: 'dms_store_invoices',
  CLAIMS: 'dms_store_claims',
  CONFIG: 'dms_store_config',
};

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AppUser[]>(() => getStored(LS_KEYS.USERS, []));
  const [tenants, setTenants] = useState<Tenant[]>(() => getStored(LS_KEYS.TENANTS, []));
  const [inventory, setInventory] = useState<SkuItem[]>(() => getStored(LS_KEYS.INVENTORY, []));
  const [outlets, setOutlets] = useState<Outlet[]>(() => getStored(LS_KEYS.OUTLETS, []));
  const [beatRoutes, setBeatRoutes] = useState<BeatRoute[]>(() => getStored(LS_KEYS.BEATS, []));
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>(() => getStored(LS_KEYS.ORDERS, []));
  const [fieldVisits, setFieldVisits] = useState<FieldVisit[]>([]);
  const [vanSales, setVanSales] = useState<VanSale[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>(() => getStored(LS_KEYS.INVOICES, []));
  const [tradeClaims, setTradeClaims] = useState<TradeClaim[]>(() => getStored(LS_KEYS.CLAIMS, []));
  const [tradeSchemes, setTradeSchemes] = useState<TradeScheme[]>([]);
  const [auditChain, setAuditChain] = useState<AuditBlock[]>([]);
  const [syncQueue, setSyncQueue] = useState<SyncTask[]>([]);
  const [configFlags, setConfigFlags] = useState<ConfigFlag[]>(() => getStored(LS_KEYS.CONFIG, []));
  const [platformNodes, setPlatformNodes] = useState<PlatformNode[]>([]);

  // ── Helper to merge remote fetched items with local user-created additions ──
  const mergeLists = <T extends { id?: string; sku?: string; key?: string }>(
    remote: T[],
    localStored: T[],
    idKey: keyof T
  ): T[] => {
    if (!localStored || localStored.length === 0) return remote;
    const remoteKeys = new Set(remote.map((r) => r[idKey]));
    const customLocal = localStored.filter((l) => !remoteKeys.has(l[idKey]));
    return [...customLocal, ...remote];
  };

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

      setUsers((prev) => {
        const merged = mergeLists(u, prev, 'id');
        setStored(LS_KEYS.USERS, merged);
        return merged;
      });

      setTenants((prev) => {
        const merged = mergeLists(t, prev, 'id');
        setStored(LS_KEYS.TENANTS, merged);
        return merged;
      });

      setInventory((prev) => {
        const merged = mergeLists(inv, prev, 'sku');
        setStored(LS_KEYS.INVENTORY, merged);
        return merged;
      });

      setOutlets((prev) => {
        const merged = mergeLists(out, prev, 'id');
        setStored(LS_KEYS.OUTLETS, merged);
        return merged;
      });

      setBeatRoutes((prev) => {
        const merged = mergeLists(beats, prev, 'id');
        setStored(LS_KEYS.BEATS, merged);
        return merged;
      });

      setSalesOrders((prev) => {
        const merged = mergeLists(ord, prev, 'id');
        setStored(LS_KEYS.ORDERS, merged);
        return merged;
      });

      setInvoices((prev) => {
        const merged = mergeLists(invs, prev, 'id');
        setStored(LS_KEYS.INVOICES, merged);
        return merged;
      });

      setTradeClaims((prev) => {
        const merged = mergeLists(clm, prev, 'id');
        setStored(LS_KEYS.CLAIMS, merged);
        return merged;
      });

      setConfigFlags((prev) => {
        const merged = mergeLists(cfg, prev, 'key');
        setStored(LS_KEYS.CONFIG, merged);
        return merged;
      });

      setFieldVisits(vst);
      setVanSales(van);
      setTradeSchemes(sch);
      setAuditChain(aud);
      setSyncQueue(sync);
      setPlatformNodes(nodes);
    } catch (err) {
      console.warn('[DataContext] Error fetching data in DataProvider:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAllData();
  }, [refreshAllData]);

  // ── Reactive Persistent Mutations ──

  const addSku = (item: Omit<SkuItem, 'sku'>) => {
    const newSku: SkuItem = {
      sku: `SKU-FMCG-${String(inventory.length + 1).padStart(3, '0')}`,
      ...item,
    };
    dbService.postSku(newSku); // Send to DB API endpoint
    setInventory((prev) => {
      const updated = [newSku, ...prev];
      setStored(LS_KEYS.INVENTORY, updated);
      return updated;
    });
  };

  const addOutlet = (outlet: Omit<Outlet, 'id' | 'status'>) => {
    const newOutlet: Outlet = {
      id: `out-${Date.now()}`,
      status: 'ACTIVE',
      ...outlet,
    };
    dbService.postOutlet(newOutlet);
    setOutlets((prev) => {
      const updated = [newOutlet, ...prev];
      setStored(LS_KEYS.OUTLETS, updated);
      return updated;
    });
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
    dbService.postSalesOrder(newOrder);
    setSalesOrders((prev) => {
      const updated = [newOrder, ...prev];
      setStored(LS_KEYS.ORDERS, updated);
      return updated;
    });
  };

  const approveSalesOrder = (orderId: string) => {
    setSalesOrders((prev) => {
      const updated = prev.map((o) => (o.id === orderId ? { ...o, status: 'APPROVED' as const } : o));
      setStored(LS_KEYS.ORDERS, updated);
      return updated;
    });

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
      dbService.postInvoice(newInv);
      setInvoices((prev) => {
        const updated = [newInv, ...prev];
        setStored(LS_KEYS.INVOICES, updated);
        return updated;
      });
    }
  };

  const rejectSalesOrder = (orderId: string) => {
    setSalesOrders((prev) => {
      const updated = prev.map((o) => (o.id === orderId ? { ...o, status: 'REJECTED' as const } : o));
      setStored(LS_KEYS.ORDERS, updated);
      return updated;
    });
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
    dbService.postInvoice(newInv);
    setInvoices((prev) => {
      const updated = [newInv, ...prev];
      setStored(LS_KEYS.INVOICES, updated);
      return updated;
    });
  };

  const addTradeClaim = (claim: { distributor: string; scheme: string; amount: string }) => {
    const newClaim: TradeClaim = {
      id: `CLM-2026-${String(tradeClaims.length + 1).padStart(3, '0')}`,
      distributor: claim.distributor,
      scheme: claim.scheme,
      amount: claim.amount,
      status: 'PENDING_APPROVAL',
    };
    dbService.postTradeClaim(newClaim);
    setTradeClaims((prev) => {
      const updated = [newClaim, ...prev];
      setStored(LS_KEYS.CLAIMS, updated);
      return updated;
    });
  };

  const approveTradeClaim = (claimId: string) => {
    setTradeClaims((prev) => {
      const updated = prev.map((c) => (c.id === claimId ? { ...c, status: 'SETTLED' as const } : c));
      setStored(LS_KEYS.CLAIMS, updated);
      return updated;
    });
  };

  const addBeatRoute = (beat: Omit<BeatRoute, 'id' | 'code' | 'outletsCount' | 'status'>) => {
    const newBeat: BeatRoute = {
      id: `beat-${Date.now()}`,
      code: `BEAT-ZONE-${String(beatRoutes.length + 1).padStart(2, '0')}`,
      outletsCount: 15,
      status: 'ACTIVE',
      ...beat,
    };
    dbService.postBeatRoute(newBeat);
    setBeatRoutes((prev) => {
      const updated = [newBeat, ...prev];
      setStored(LS_KEYS.BEATS, updated);
      return updated;
    });
  };

  const addUser = (user: Omit<AppUser, 'id' | 'lastLogin' | 'status'>) => {
    const newUser: AppUser = {
      id: `usr-${Date.now()}`,
      status: 'ACTIVE',
      lastLogin: 'Never',
      ...user,
    };
    dbService.postUser(newUser);
    setUsers((prev) => {
      const updated = [newUser, ...prev];
      setStored(LS_KEYS.USERS, updated);
      return updated;
    });
  };

  const addTenant = (tenant: Omit<Tenant, 'id' | 'status'>) => {
    const newTenant: Tenant = {
      id: `00000000-0000-0000-0000-${String(tenants.length + 1).padStart(12, '0')}`,
      status: 'ACTIVE',
      ...tenant,
    };
    dbService.postTenant(newTenant);
    setTenants((prev) => {
      const updated = [newTenant, ...prev];
      setStored(LS_KEYS.TENANTS, updated);
      return updated;
    });
  };

  const toggleConfigFlag = (key: string) => {
    setConfigFlags((prev) => {
      const updated = prev.map((f) => (f.key === key ? { ...f, enabled: !f.enabled } : f));
      setStored(LS_KEYS.CONFIG, updated);
      return updated;
    });
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
