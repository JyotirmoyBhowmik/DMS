export interface MFADeviceCacheRecord {
  id: string;
  tenantId: string;
  userId: string;
  type: 'TOTP' | 'SMS' | 'EMAIL' | 'SECURITY_KEY';
  secretEncrypted: string;
  isActive: boolean;
  lastUsedAt: string | null;
  version: number;
  isDeleted: boolean;
  syncStatus: 'PENDING' | 'SYNCED' | 'CONFLICT';
  updatedAt: string;
}

export interface PendingMutation {
  mutationId: string;
  deviceId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: Partial<MFADeviceCacheRecord>;
  timestamp: string;
}

export class MFADeviceOfflineCache {
  private cache = new Map<string, MFADeviceCacheRecord>();
  private mutationQueue: PendingMutation[] = [];

  constructor(initialData?: MFADeviceCacheRecord[]) {
    if (initialData) {
      initialData.forEach(item => this.cache.set(item.id, { ...item }));
    }
  }

  saveDevice(record: Omit<MFADeviceCacheRecord, 'syncStatus'>): MFADeviceCacheRecord {
    const fullRecord: MFADeviceCacheRecord = {
      ...record,
      syncStatus: 'SYNCED',
    };
    this.cache.set(fullRecord.id, fullRecord);
    return fullRecord;
  }

  getDevices(tenantId: string, userId?: string): MFADeviceCacheRecord[] {
    return Array.from(this.cache.values()).filter(item => {
      if (item.tenantId !== tenantId) return false;
      if (item.isDeleted) return false;
      if (userId && item.userId !== userId) return false;
      return true;
    });
  }

  getDeviceById(id: string, tenantId: string): MFADeviceCacheRecord | null {
    const record = this.cache.get(id);
    if (!record || record.tenantId !== tenantId || record.isDeleted) return null;
    return record;
  }

  enqueueMutation(deviceId: string, action: 'CREATE' | 'UPDATE' | 'DELETE', payload: Partial<MFADeviceCacheRecord>): PendingMutation {
    let randStr: string;
    try {
      const array = new Uint8Array(4);
      globalThis.crypto.getRandomValues(array);
      randStr = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      randStr = Math.random().toString(36).substring(2, 7);
    }
    const mutationId = `mut-${Date.now()}-${randStr}`;
    const mutation: PendingMutation = {
      mutationId,
      deviceId,
      action,
      payload,
      timestamp: new Date().toISOString(),
    };

    // Update local cache optimistically
    const existing = this.cache.get(deviceId);
    if (action === 'DELETE') {
      if (existing) {
        this.cache.set(deviceId, {
          ...existing,
          isDeleted: true,
          syncStatus: 'PENDING',
          updatedAt: mutation.timestamp,
        });
      }
    } else if (existing) {
      this.cache.set(deviceId, {
        ...existing,
        ...payload,
        syncStatus: 'PENDING',
        version: existing.version + 1,
        updatedAt: mutation.timestamp,
      });
    } else {
      this.cache.set(deviceId, {
        id: deviceId,
        tenantId: payload.tenantId || '00000000-0000-0000-0000-000000000001',
        userId: payload.userId || 'usr-default',
        type: payload.type || 'TOTP',
        secretEncrypted: payload.secretEncrypted || 'enc-secret',
        isActive: payload.isActive !== undefined ? payload.isActive : true,
        lastUsedAt: payload.lastUsedAt || null,
        version: 1,
        isDeleted: false,
        syncStatus: 'PENDING',
        updatedAt: mutation.timestamp,
      });
    }

    this.mutationQueue.push(mutation);
    return mutation;
  }

  getPendingMutations(): PendingMutation[] {
    return [...this.mutationQueue];
  }

  clearMutation(mutationId: string): void {
    this.mutationQueue = this.mutationQueue.filter(m => m.mutationId !== mutationId);
  }

  resolveConflict(deviceId: string, serverRecord: MFADeviceCacheRecord): MFADeviceCacheRecord {
    const local = this.cache.get(deviceId);
    if (!local) {
      this.cache.set(deviceId, { ...serverRecord, syncStatus: 'SYNCED' });
      return serverRecord;
    }

    // Server-wins conflict resolution policy for optimistic versioning
    if (serverRecord.version >= local.version) {
      const merged: MFADeviceCacheRecord = {
        ...serverRecord,
        syncStatus: 'SYNCED',
      };
      this.cache.set(deviceId, merged);
      return merged;
    } else {
      const conflictRecord: MFADeviceCacheRecord = {
        ...local,
        syncStatus: 'CONFLICT',
      };
      this.cache.set(deviceId, conflictRecord);
      return conflictRecord;
    }
  }
}
