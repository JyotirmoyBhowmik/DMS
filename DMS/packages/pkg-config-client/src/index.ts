import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export class ConfigClient {
  private readonly configServiceUrl: string;
  private readonly pollIntervalMs: number;
  private readonly flags: Map<string, boolean> = new Map();
  private readonly cacheFilePath: string;
  private pollInterval: NodeJS.Timeout | null = null;
  private currentTenantId: string | null = null;

  constructor(opts: { configServiceUrl?: string; pollIntervalMs?: number; cacheDir?: string } = {}) {
    this.configServiceUrl = opts.configServiceUrl ?? 'http://localhost:3000';
    this.pollIntervalMs = opts.pollIntervalMs ?? 30000; // default 30s target poll interval
    
    // Determine path to local persistent cache file
    const dir = opts.cacheDir ?? tmpdir();
    this.cacheFilePath = join(dir, '.dms-flags-cache.json');

    // Seed default fallback flags
    this.flags.set('enable-ai-recommendations', true);
    this.flags.set('strict-offline-integrity', false);

    // Load initial fallback cache if it exists
    this.loadCacheFileSync();
  }

  /**
   * Loads cached flags synchronously from disk on startup.
   */
  private loadCacheFileSync(): void {
    try {
      // We can do this synchronously during construction or async later.
      // To prevent blocking, we will load it asynchronously in an unawaited call, 
      // or we can read it on-demand. Let's read it asynchronously right now.
      this.loadCacheFile().catch(() => {
        // Silently tolerate if cache file does not exist yet
      });
    } catch {
      // Tolerate fs errors
    }
  }

  private async loadCacheFile(): Promise<void> {
    try {
      const data = await fs.readFile(this.cacheFilePath, 'utf-8');
      const parsed = JSON.parse(data) as Record<string, boolean>;
      for (const [key, value] of Object.entries(parsed)) {
        this.flags.set(key, value);
      }
    } catch {
      // Tolerate file not found/parse errors
    }
  }

  private async saveCacheFile(): Promise<void> {
    try {
      const obj: Record<string, boolean> = {};
      for (const [key, value] of this.flags.entries()) {
        obj[key] = value;
      }
      await fs.writeFile(this.cacheFilePath, JSON.stringify(obj, null, 2), 'utf-8');
    } catch {
      // Tolerate write failures
    }
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

  async syncFlags(tenantId: string): Promise<void> {
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
        // Persist newly fetched flags to disk fallback cache
        await this.saveCacheFile();
      }
    } catch (err) {
      // Fallback cache logic: attempt to load from disk if remote service fails
      await this.loadCacheFile();
      throw err;
    }
  }
}
export { ConfigClient as FlagClient };
