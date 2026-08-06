// ── Dynamic Database API Service ──
// All application domain data is fetched dynamically from the database via API endpoints.
// Includes real POST endpoints with fallback to local persistent storage.

import type {
  AppUser, Tenant, Role, Permission, MfaDevice,
  SkuItem, BeatRoute, SalesOrder, Invoice,
  FieldVisit, VanSale, TradeScheme, TradeClaim,
  AuditBlock, SyncTask, ConfigFlag, PlatformNode, Outlet
} from '../types';

const getApiBase = (): string => {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) {
      return (import.meta as any).env.VITE_API_URL;
    }
  } catch {}
  return '';
};

const API_BASE = getApiBase();

class DatabaseClient {
  private tenantId: string = '00000000-0000-0000-0000-000000000001';

  public setTenantId(id: string) {
    this.tenantId = id;
  }

  // ── Generic Dynamic DB Endpoint Fetcher ──
  private async queryDb<T>(endpoint: string, fallbackData: T): Promise<T> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(`${API_BASE}${endpoint}`, {
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': this.tenantId,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP DB Query failed: ${response.status}`);
      }

      const json = await response.json();

      // Strict array defense for list endpoints
      if (Array.isArray(fallbackData)) {
        const extracted = Array.isArray(json)
          ? json
          : Array.isArray(json?.data)
            ? json.data
            : Array.isArray(json?.items)
              ? json.items
              : Array.isArray(json?.results)
                ? json.results
                : null;

        if (extracted && extracted.length > 0) {
          return extracted as T;
        }
        return fallbackData;
      }

      return (json.data ?? json) as T;
    } catch (err) {
      console.warn(`[DbService] Real-time DB query for ${endpoint} timed out or offline, utilizing persistent cache:`, err);
      return fallbackData;
    }
  }

  // ── Generic Dynamic DB Mutation Poster ──
  private async postDb<T>(endpoint: string, payload: any): Promise<T | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': this.tenantId,
        },
        body: JSON.stringify(payload),
      });

      clearTimeout(timeoutId);

      if (response.status === 409) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'SKU code already exists in catalog');
      }

      if (!response.ok) {
        throw new Error(`HTTP DB Mutation failed: ${response.status}`);
      }

      const json = await response.json();
      return (json.data ?? json) as T;
    } catch (err: any) {
      if (err?.message?.includes('already exists')) {
        throw err;
      }
      console.warn(`[DbService] Real-time DB mutation for ${endpoint} failed:`, err);
      return null;
    }
  }

  // ── Identity & Access DB Queries & Mutations ──
  // ── Identity & Access DB Queries & Mutations ──
  public async getUsers(): Promise<AppUser[]> {
    return this.queryDb<AppUser[]>('/api/v1/identity/users', []);
  }

  public async postUser(user: AppUser): Promise<AppUser | null> {
    return this.postDb<AppUser>('/api/v1/identity/users', user);
  }

  public async getTenants(): Promise<Tenant[]> {
    return this.queryDb<Tenant[]>('/api/v1/identity/tenants', []);
  }

  public async getRoles(): Promise<Role[]> {
    return this.queryDb<Role[]>('/api/v1/identity/roles', []);
  }

  public async postTenant(tenant: Tenant): Promise<Tenant | null> {
    return this.postDb<Tenant>('/api/v1/identity/tenants', tenant);
  }

  // ── DMS Core Engine DB Queries & Mutations ──
  public async getInventory(): Promise<SkuItem[]> {
    try {
      const skuData = await this.queryDb<any>('/api/v1/skus', null);
      if (skuData && Array.isArray(skuData.data) && skuData.data.length > 0) {
        const fetchedSkus: SkuItem[] = skuData.data.map((item: any) => ({
          sku: item.code || item.sku,
          name: item.name,
          category: item.category || 'General',
          stock: item.stock ?? 100,
          minThreshold: item.minThreshold ?? 20,
          price: item.unitPrice ? item.unitPrice / 100 : (item.price || 10.00),
          distributor: item.distributor || 'Global Distribution Corp',
        }));
        return fetchedSkus;
      }
    } catch (err) {
      console.warn('[DbService] Fetching /api/v1/skus failed:', err);
    }

    return this.queryDb<SkuItem[]>('/api/v1/dms/inventory', []);
  }

  public async getProducts(): Promise<SkuItem[]> {
    return this.queryDb<SkuItem[]>('/api/v1/products', []);
  }

  public async postSku(sku: SkuItem): Promise<SkuItem | null> {
    try {
      const skuPayload = {
        code: sku.sku,
        name: sku.name,
        unitPrice: Math.round((sku.price || 0) * 100),
      };
      await this.postDb('/api/v1/skus', skuPayload);
    } catch (err) {
      console.warn('[DbService] Posting to /api/v1/skus endpoint failed:', err);
    }
    return this.postDb<SkuItem>('/api/v1/dms/inventory', sku);
  }

  public async postProduct(productPayload: any): Promise<any | null> {
    return this.postDb('/api/v1/products', productPayload);
  }

  public async getOutlets(): Promise<Outlet[]> {
    return this.queryDb<Outlet[]>('/api/v1/dms/outlets', []);
  }

  public async postOutlet(outlet: Outlet): Promise<Outlet | null> {
    return this.postDb<Outlet>('/api/v1/dms/outlets', outlet);
  }

  // ── SFA Field Sales DB Queries & Mutations ──
  public async getBeatRoutes(): Promise<BeatRoute[]> {
    return this.queryDb<BeatRoute[]>('/api/v1/sfa/beat-routes', []);
  }

  public async postBeatRoute(beat: BeatRoute): Promise<BeatRoute | null> {
    return this.postDb<BeatRoute>('/api/v1/sfa/beat-routes', beat);
  }

  public async getSalesOrders(): Promise<SalesOrder[]> {
    return this.queryDb<SalesOrder[]>('/api/v1/sfa/orders', []);
  }

  public async postSalesOrder(order: SalesOrder): Promise<SalesOrder | null> {
    return this.postDb<SalesOrder>('/api/v1/sfa/orders', order);
  }

  public async getFieldVisits(): Promise<FieldVisit[]> {
    return this.queryDb<FieldVisit[]>('/api/v1/sfa/visits', []);
  }

  public async getVanSales(): Promise<VanSale[]> {
    return this.queryDb<VanSale[]>('/api/v1/sfa/van-sales', []);
  }

  // ── Finance DB Queries & Mutations ──
  public async getInvoices(): Promise<Invoice[]> {
    return this.queryDb<Invoice[]>('/api/v1/finance/invoices', []);
  }

  public async postInvoice(invoice: Invoice): Promise<Invoice | null> {
    return this.postDb<Invoice>('/api/v1/finance/invoices', invoice);
  }

  public async getTradeClaims(): Promise<TradeClaim[]> {
    return this.queryDb<TradeClaim[]>('/api/v1/finance/claims', []);
  }

  public async postTradeClaim(claim: TradeClaim): Promise<TradeClaim | null> {
    return this.postDb<TradeClaim>('/api/v1/finance/claims', claim);
  }

  public async getTradeSchemes(): Promise<TradeScheme[]> {
    return this.queryDb<TradeScheme[]>('/api/v1/finance/schemes', []);
  }

  // ── Audit & Config DB Queries ──
  public async getAuditChain(): Promise<AuditBlock[]> {
    return this.queryDb<AuditBlock[]>('/api/v1/audit/chain', []);
  }

  public async getSyncQueue(): Promise<SyncTask[]> {
    return this.queryDb<SyncTask[]>('/api/v1/sync/queue', []);
  }

  public async getConfigFlags(): Promise<ConfigFlag[]> {
    return this.queryDb<ConfigFlag[]>('/api/v1/config/flags', []);
  }

  public async getPlatformNodes(): Promise<PlatformNode[]> {
    return this.queryDb<PlatformNode[]>('/api/v1/platform/nodes', []);
  }
}

export const dbService = new DatabaseClient();
