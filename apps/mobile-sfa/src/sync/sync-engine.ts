import { SyncRequest, SyncResponse, PushRequest, PushResponse } from '@dms/pkg-mobile-sync';

const API_GATEWAY_URL = 'http://localhost:3000'; // Default API Gateway URL

export class SyncEngine {
  private lastSyncTimestamp: number = 0;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private isSyncing = false;

  constructor(private token: string) {}

  public startPeriodicSync(intervalMs: number = 60000) {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    this.syncInterval = setInterval(() => this.sync(), intervalMs);
  }

  public stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  public async sync() {
    if (this.isSyncing) return;
    this.isSyncing = true;
    try {
      await this.push();
      await this.pull();
    } catch (error) {
      console.error('Sync failed', error);
    } finally {
      this.isSyncing = false;
    }
  }

  private async pull() {
    const request: SyncRequest = { lastSyncTimestamp: this.lastSyncTimestamp };
    
    const response = await fetch(`${API_GATEWAY_URL}/api/sync/pull`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`Pull failed: ${response.statusText}`);
    }

    const data: SyncResponse = await response.json();
    this.lastSyncTimestamp = data.serverTimestamp;
    
    // Here we would apply data.orders, data.visits, data.outlets to the local SQLite database
    console.log('Pull successful, received', data);
  }

  private async push() {
    // Mock local data to push
    const request: PushRequest = {
      orders: [],
      visits: [],
      outlets: [],
      lastSyncTimestamp: this.lastSyncTimestamp
    };

    const response = await fetch(`${API_GATEWAY_URL}/api/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`Push failed: ${response.statusText}`);
    }

    const data: PushResponse = await response.json();
    if (data.success) {
      this.lastSyncTimestamp = data.serverTimestamp;
      // Here we would mark local records as synced
      console.log('Push successful');
    }
  }
}
