import { AesGcm } from './security/aes_gcm.js';
import { TokenSession } from './session_manager.js';

export interface OutletSyncQueueItem {
  outletId: string;
  action: 'create' | 'update';
  payload: any;
  version: number;
}

export class OutletOfflineCache {
  private offlineStorage = new Map<string, string>(); // outletId -> packed encrypted string
  private syncQueue: OutletSyncQueueItem[] = [];

  constructor(private readonly session: TokenSession) {}

  /**
   * Encrypts and caches an Outlet offline, then enqueues it for sync.
   */
  saveOutletOffline(outlet: any, action: 'create' | 'update'): void {
    if (!outlet.id) {
      throw new Error('Outlet record must contain an id');
    }

    const key = Buffer.from(this.session.clientSecretKeyHex, 'hex');
    const plaintext = Buffer.from(JSON.stringify(outlet));

    // AES-GCM Encryption
    const sealed = AesGcm.encrypt(plaintext, key);
    const packed = AesGcm.pack(sealed);

    // Save to local storage map
    this.offlineStorage.set(outlet.id, packed);

    // Enqueue FIFO update
    const existingIndex = this.syncQueue.findIndex(item => item.outletId === outlet.id);
    const queueItem: OutletSyncQueueItem = {
      outletId: outlet.id,
      action,
      payload: outlet,
      version: outlet.version || 1,
    };

    if (existingIndex > -1) {
      this.syncQueue[existingIndex] = queueItem;
    } else {
      this.syncQueue.push(queueItem);
    }
  }

  /**
   * Decrypts and retrieves an offline cached Outlet.
   */
  getOutletOffline(id: string): any | null {
    const packed = this.offlineStorage.get(id);
    if (!packed) {
      return null;
    }

    const key = Buffer.from(this.session.clientSecretKeyHex, 'hex');
    const sealed = AesGcm.unpack(packed);
    const decrypted = AesGcm.decrypt(sealed, key);

    return JSON.parse(decrypted.toString());
  }

  getSyncQueue(): OutletSyncQueueItem[] {
    return [...this.syncQueue];
  }

  clearOutletOffline(id: string): void {
    this.offlineStorage.delete(id);
    this.syncQueue = this.syncQueue.filter(item => item.outletId !== id);
  }

  async syncOutlet(
    id: string,
    apiSyncCall: (outlet: any) => Promise<{ success: boolean; conflict?: boolean; serverVersion?: number }>
  ): Promise<void> {
    const queueItem = this.syncQueue.find(item => item.outletId === id);
    if (!queueItem) {
      throw new Error(`Outlet with ID ${id} not found in sync queue`);
    }

    const result = await apiSyncCall(queueItem.payload);

    if (result.success) {
      this.clearOutletOffline(id);
    } else if (result.conflict) {
      throw new Error('CONCURRENCY_CONFLICT');
    } else {
      throw new Error('SYNC_FAILED');
    }
  }
}
