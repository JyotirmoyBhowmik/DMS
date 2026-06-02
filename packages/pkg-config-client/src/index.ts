export class ConfigClient {
  private readonly configServiceUrl: string;
  private readonly pollIntervalMs: number;
  private readonly flags: Map<string, boolean> = new Map();
  private pollInterval: NodeJS.Timeout | null = null;
  private currentTenantId: string | null = null;

  constructor(opts: { configServiceUrl?: string; pollIntervalMs?: number } = {}) {
    this.configServiceUrl = opts.configServiceUrl ?? 'http://localhost:3000';
    this.pollIntervalMs = opts.pollIntervalMs ?? 30000; // default 30s target poll interval
    
    // Seed default fallback flags
    this.flags.set('enable-ai-recommendations', true);
    this.flags.set('strict-offline-integrity', false);
  }

  /**
   * Get feature flag from local memory cache.
   */
  getFeatureFlag(key: string, tenantId: string): boolean {
    // If tenant context changes, trigger an eager sync
    if (tenantId !== this.currentTenantId) {
      this.currentTenantId = tenantId;
      this.syncFlags(tenantId).catch(() => {
        // Keep fallback flags on sync failure
      });
    }
    return this.flags.get(key) ?? false;
  }

  /**
   * Start background polling for the target tenant feature flags.
   */
  startPolling(tenantId: string): void {
    this.stopPolling();
    this.currentTenantId = tenantId;
    
    this.pollInterval = setInterval(() => {
      this.syncFlags(tenantId).catch((err) => {
        console.error(`[ConfigClient] Failed to poll flags: ${String(err)}`);
      });
    }, this.pollIntervalMs);
  }

  /**
   * Stop background polling.
   */
  stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private async syncFlags(tenantId: string): Promise<void> {
    const url = `${this.configServiceUrl}/configs/eval`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tenantId }),
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const body = (await response.json()) as { flags?: Record<string, boolean> };
      if (body?.flags) {
        for (const [key, value] of Object.entries(body.flags)) {
          this.flags.set(key, value);
        }
      }
    } catch (err) {
      // Fetch failures are tolerated — client will fallback to memory cache
      throw err;
    }
  }
}
export { ConfigClient as FlagClient };
