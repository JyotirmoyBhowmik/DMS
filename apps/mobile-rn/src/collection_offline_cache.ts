import { AesGcm } from './security/aes_gcm.js';
import { TokenSession } from './session_manager.js';

export interface CollectionSyncQueueItem {
  collectionId: string;
  action: 'create' | 'update';
  payload: any;
  version: number;
}

export class CollectionOfflineCache {
  private offlineStorage = new Map<string, string>(); // collectionId -> packed encrypted string
  private syncQueue: CollectionSyncQueueItem[] = [];

  constructor(private readonly session: TokenSession) {}

  /**
   * Encrypts and caches a Collection record offline using AES-256-GCM, then enqueues it for sync.
   */
  saveCollectionOffline(collection: any, action: 'create' | 'update'): void {
    if (!collection.id) {
      throw new Error('Collection record must contain an id');
    }

    const key = Buffer.from(this.session.clientSecretKeyHex, 'hex');
    const plaintext = Buffer.from(JSON.stringify(collection));

    // Encrypt using AesGcm
    const sealed = AesGcm.encrypt(plaintext, key);
    const packed = AesGcm.pack(sealed);

    // Save to encrypted offline storage
    this.offlineStorage.set(collection.id, packed);

    // Update FIFO sync queue (prevent duplicates by updating in-place)
    const existingIndex = this.syncQueue.findIndex(item => item.collectionId === collection.id);
    const queueItem: CollectionSyncQueueItem = {
      collectionId: collection.id,
      action,
      payload: collection,
      version: collection.version || 1,
    };

    if (existingIndex > -1) {
      this.syncQueue[existingIndex] = queueItem;
    } else {
      this.syncQueue.push(queueItem);
    }
  }

  /**
   * Retrieves, decrypts and parses a cached Collection record.
   */
  getCollectionOffline(id: string): any | null {
    const packed = this.offlineStorage.get(id);
    if (!packed) {
      return null;
    }

    const key = Buffer.from(this.session.clientSecretKeyHex, 'hex');
    const sealed = AesGcm.unpack(packed);
    const decrypted = AesGcm.decrypt(sealed, key);

    return JSON.parse(decrypted.toString());
  }

  /**
   * Returns a copy of the current sync queue.
   */
  getSyncQueue(): CollectionSyncQueueItem[] {
    return [...this.syncQueue];
  }

  /**
   * Removes a Collection record from offline cache and sync queue.
   */
  clearCollectionOffline(id: string): void {
    this.offlineStorage.delete(id);
    this.syncQueue = this.syncQueue.filter(item => item.collectionId !== id);
  }

  /**
   * Synchronizes a Collection record with the remote backend server.
   */
  async syncCollection(
    id: string,
    apiSyncCall: (collection: any) => Promise<{ success: boolean; conflict?: boolean; serverVersion?: number }>
  ): Promise<void> {
    const queueItem = this.syncQueue.find(item => item.collectionId === id);
    if (!queueItem) {
      throw new Error(`Collection with ID ${id} not found in sync queue`);
    }

    const result = await apiSyncCall(queueItem.payload);

    if (result.success) {
      // Sync completed successfully, clear local cache
      this.clearCollectionOffline(id);
    } else if (result.conflict) {
      throw new Error('CONCURRENCY_CONFLICT');
    } else {
      throw new Error('SYNC_FAILED');
    }
  }

  /**
   * Resolves offline sync conflicts via keep_local, keep_server or merge strategies.
   */
  resolveConflict(
    id: string,
    strategy: 'keep_local' | 'keep_server' | 'merge',
    serverCollection?: any
  ): void {
    const localCollection = this.getCollectionOffline(id);
    if (!localCollection) {
      throw new Error(`Collection with ID ${id} not found in local cache`);
    }

    if (strategy === 'keep_local') {
      const serverVersion = serverCollection?.version || localCollection.version;
      const updatedCollection = {
        ...localCollection,
        version: serverVersion + 1,
        updatedAt: new Date().toISOString(),
      };
      this.saveCollectionOffline(updatedCollection, 'update');
    } else if (strategy === 'keep_server') {
      if (!serverCollection) {
        throw new Error('Server collection record is required for keep_server strategy');
      }
      const key = Buffer.from(this.session.clientSecretKeyHex, 'hex');
      const plaintext = Buffer.from(JSON.stringify(serverCollection));
      const sealed = AesGcm.encrypt(plaintext, key);
      const packed = AesGcm.pack(sealed);

      this.offlineStorage.set(id, packed);
      this.syncQueue = this.syncQueue.filter(item => item.collectionId !== id);
    } else if (strategy === 'merge') {
      if (!serverCollection) {
        throw new Error('Server collection record is required for merge strategy');
      }
      const serverVersion = serverCollection.version || localCollection.version;
      const mergedCollection = {
        ...serverCollection,
        ...localCollection,
        amountCents: localCollection.amountCents || serverCollection.amountCents,
        version: serverVersion + 1,
        updatedAt: new Date().toISOString(),
      };
      this.saveCollectionOffline(mergedCollection, 'update');
    }
  }
}
