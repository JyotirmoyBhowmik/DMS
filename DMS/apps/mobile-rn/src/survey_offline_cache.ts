import { AesGcm } from './security/aes_gcm.js';
import { TokenSession } from './session_manager.js';

export interface SyncQueueItem {
  surveyId: string;
  action: 'create' | 'update';
  payload: any;
  version: number;
}

export class SurveyOfflineCache {
  private offlineStorage = new Map<string, string>(); // surveyId -> packed encrypted string
  private syncQueue: SyncQueueItem[] = [];

  constructor(private readonly session: TokenSession) {}

  /**
   * Encrypts and caches a survey record offline, then adds it to the sync queue.
   */
  saveSurveyOffline(survey: any, action: 'create' | 'update'): void {
    if (!survey.id) {
      throw new Error('Survey record must contain an id');
    }

    const key = Buffer.from(this.session.clientSecretKeyHex, 'hex');
    const plaintext = Buffer.from(JSON.stringify(survey));
    
    // Encrypt using AesGcm
    const sealed = AesGcm.encrypt(plaintext, key);
    const packed = AesGcm.pack(sealed);

    // Save to offline storage
    this.offlineStorage.set(survey.id, packed);

    // Update sync queue (FIFO order, prevent duplicates by updating in-place)
    const existingIndex = this.syncQueue.findIndex(item => item.surveyId === survey.id);
    const queueItem: SyncQueueItem = {
      surveyId: survey.id,
      action,
      payload: survey,
      version: survey.version || 1,
    };

    if (existingIndex > -1) {
      this.syncQueue[existingIndex] = queueItem;
    } else {
      this.syncQueue.push(queueItem);
    }
  }

  /**
   * Retrieves, decrypts and parses a cached survey record.
   */
  getSurveyOffline(id: string): any | null {
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
  getSyncQueue(): SyncQueueItem[] {
    return [...this.syncQueue];
  }

  /**
   * Removes a survey record from offline cache and sync queue.
   */
  clearSurveyOffline(id: string): void {
    this.offlineStorage.delete(id);
    this.syncQueue = this.syncQueue.filter(item => item.surveyId !== id);
  }

  /**
   * Attempts to synchronize a survey record with the remote server.
   */
  async syncSurvey(
    id: string,
    apiSyncCall: (survey: any) => Promise<{ success: boolean; conflict?: boolean; serverVersion?: number }>
  ): Promise<void> {
    const queueItem = this.syncQueue.find(item => item.surveyId === id);
    if (!queueItem) {
      throw new Error(`Survey with ID ${id} not found in sync queue`);
    }

    const result = await apiSyncCall(queueItem.payload);

    if (result.success) {
      // Sync completed successfully, clear local cache
      this.clearSurveyOffline(id);
    } else if (result.conflict) {
      throw new Error('CONCURRENCY_CONFLICT');
    } else {
      throw new Error('SYNC_FAILED');
    }
  }

  /**
   * Handles resolving sync conflicts using keep_local, keep_server or merge strategies.
   */
  resolveConflict(
    id: string,
    strategy: 'keep_local' | 'keep_server' | 'merge',
    serverSurvey?: any
  ): void {
    const localSurvey = this.getSurveyOffline(id);
    if (!localSurvey) {
      throw new Error(`Survey with ID ${id} not found in local cache`);
    }

    if (strategy === 'keep_local') {
      // Accept server's version but bump it so our local changes overwrite the server
      const serverVersion = serverSurvey?.version || localSurvey.version;
      const updatedSurvey = {
        ...localSurvey,
        version: serverVersion + 1,
        updatedAt: new Date().toISOString(),
      };
      this.saveSurveyOffline(updatedSurvey, 'update');
    } else if (strategy === 'keep_server') {
      if (!serverSurvey) {
        throw new Error('Server survey record is required for keep_server strategy');
      }
      // Overwrite local cache with server data and clear from sync queue
      const key = Buffer.from(this.session.clientSecretKeyHex, 'hex');
      const plaintext = Buffer.from(JSON.stringify(serverSurvey));
      const sealed = AesGcm.encrypt(plaintext, key);
      const packed = AesGcm.pack(sealed);
      
      this.offlineStorage.set(id, packed);
      this.syncQueue = this.syncQueue.filter(item => item.surveyId !== id);
    } else if (strategy === 'merge') {
      if (!serverSurvey) {
        throw new Error('Server survey record is required for merge strategy');
      }
      // Merge answers, bump version to serverVersion + 1
      const serverVersion = serverSurvey.version || localSurvey.version;
      const mergedSurvey = {
        ...serverSurvey,
        ...localSurvey,
        answers: {
          ...(serverSurvey.answers || {}),
          ...(localSurvey.answers || {}),
        },
        version: serverVersion + 1,
        updatedAt: new Date().toISOString(),
      };
      this.saveSurveyOffline(mergedSurvey, 'update');
    }
  }
}
