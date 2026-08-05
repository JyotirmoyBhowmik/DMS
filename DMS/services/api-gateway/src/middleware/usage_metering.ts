export interface TenantUsageMetrics {
  tenantId: string;
  apiCallsCount: number;
  storageBytesConsumed: number;
  activeUsersCount: number;
  lastUpdated: string;
}

export class UsageMeteringService {
  private static tenantUsageStore = new Map<string, TenantUsageMetrics>();

  /**
   * Increments the API call metering counter for a specific tenant.
   */
  static recordApiCall(tenantId: string): void {
    const existing = this.getOrCreateUsage(tenantId);
    existing.apiCallsCount += 1;
    existing.lastUpdated = new Date().toISOString();
  }

  /**
   * Updates storage consumption bytes for a tenant.
   */
  static recordStorageBytes(tenantId: string, bytes: number): void {
    const existing = this.getOrCreateUsage(tenantId);
    existing.storageBytesConsumed += bytes;
    existing.lastUpdated = new Date().toISOString();
  }

  /**
   * Sets active user count metric for billing aggregation.
   */
  static recordActiveUsers(tenantId: string, userCount: number): void {
    const existing = this.getOrCreateUsage(tenantId);
    existing.activeUsersCount = userCount;
    existing.lastUpdated = new Date().toISOString();
  }

  /**
   * Returns current billing usage metrics for a tenant.
   */
  static getTenantUsage(tenantId: string): TenantUsageMetrics {
    return { ...this.getOrCreateUsage(tenantId) };
  }

  private static getOrCreateUsage(tenantId: string): TenantUsageMetrics {
    let usage = this.tenantUsageStore.get(tenantId);
    if (!usage) {
      usage = {
        tenantId,
        apiCallsCount: 0,
        storageBytesConsumed: 0,
        activeUsersCount: 1,
        lastUpdated: new Date().toISOString(),
      };
      this.tenantUsageStore.set(tenantId, usage);
    }
    return usage;
  }
}
