import { AesGcm } from './security/aes_gcm.js';
import { TokenSession } from './session_manager.js';

export interface KYCSyncQueueItem {
  documentId: string;
  action: 'create' | 'update';
  payload: any;
  version: number;
}

export class KYCDocumentOfflineCache {
  private offlineStorage = new Map<string, string>(); // documentId -> packed encrypted string
  private syncQueue: KYCSyncQueueItem[] = [];

  constructor(private readonly session: TokenSession) {}

  /**
   * Encrypts and caches a KYC document offline, then enqueues it for sync.
   */
  saveDocumentOffline(doc: any, action: 'create' | 'update'): void {
    if (!doc.id) {
      throw new Error('KYC document record must contain an id');
    }

    const key = Buffer.from(this.session.clientSecretKeyHex, 'hex');
    const plaintext = Buffer.from(JSON.stringify(doc));
    
    // AES-GCM Encryption
    const sealed = AesGcm.encrypt(plaintext, key);
    const packed = AesGcm.pack(sealed);

    // Save to local storage map
    this.offlineStorage.set(doc.id, packed);

    // Enqueue FIFO update
    const existingIndex = this.syncQueue.findIndex(item => item.documentId === doc.id);
    const queueItem: KYCSyncQueueItem = {
      documentId: doc.id,
      action,
      payload: doc,
      version: doc.version || 1,
    };

    if (existingIndex > -1) {
      this.syncQueue[existingIndex] = queueItem;
    } else {
      this.syncQueue.push(queueItem);
    }
  }

  /**
   * Decrypts and retrieves an offline cached KYC document.
   */
  getDocumentOffline(id: string): any | null {
    const packed = this.offlineStorage.get(id);
    if (!packed) {
      return null;
    }

    const key = Buffer.from(this.session.clientSecretKeyHex, 'hex');
    const sealed = AesGcm.unpack(packed);
    const decrypted = AesGcm.decrypt(sealed, key);

    return JSON.parse(decrypted.toString());
  }

  getSyncQueue(): KYCSyncQueueItem[] {
    return [...this.syncQueue];
  }

  clearDocumentOffline(id: string): void {
    this.offlineStorage.delete(id);
    this.syncQueue = this.syncQueue.filter(item => item.documentId !== id);
  }

  async syncDocument(
    id: string,
    apiSyncCall: (doc: any) => Promise<{ success: boolean; conflict?: boolean; serverVersion?: number }>
  ): Promise<void> {
    const queueItem = this.syncQueue.find(item => item.documentId === id);
    if (!queueItem) {
      throw new Error(`KYC document with ID ${id} not found in sync queue`);
    }

    const result = await apiSyncCall(queueItem.payload);

    if (result.success) {
      this.clearDocumentOffline(id);
    } else if (result.conflict) {
      throw new Error('CONCURRENCY_CONFLICT');
    } else {
      throw new Error('SYNC_FAILED');
    }
  }
}
