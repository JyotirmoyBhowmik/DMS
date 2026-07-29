export interface OfflineFileObject {
  id: string;
  tenantId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  checksum: string;
  status: 'PENDING' | 'UPLOADED' | 'ARCHIVED' | 'DELETED';
  version: number;
  isSynced: boolean;
  isDeleted: boolean;
  updatedAt: string;
}

export class FileObjectOfflineCache {
  private cache: Map<string, OfflineFileObject> = new Map();
  private mutationQueue: Array<{ action: 'CREATE' | 'UPDATE' | 'DELETE'; file: OfflineFileObject }> = [];

  public async save(file: Omit<OfflineFileObject, 'isSynced' | 'isDeleted' | 'updatedAt'>): Promise<OfflineFileObject> {
    const item: OfflineFileObject = {
      ...file,
      isSynced: false,
      isDeleted: false,
      updatedAt: new Date().toISOString()
    };
    this.cache.set(item.id, item);
    this.mutationQueue.push({ action: 'CREATE', file: item });
    return item;
  }

  public async getById(id: string): Promise<OfflineFileObject | null> {
    const item = this.cache.get(id);
    if (!item || item.isDeleted) return null;
    return { ...item };
  }

  public async getAll(tenantId: string): Promise<OfflineFileObject[]> {
    return Array.from(this.cache.values()).filter(i => i.tenantId === tenantId && !i.isDeleted);
  }

  public async delete(id: string): Promise<boolean> {
    const item = this.cache.get(id);
    if (!item) return false;
    item.isDeleted = true;
    item.isSynced = false;
    item.updatedAt = new Date().toISOString();
    this.mutationQueue.push({ action: 'DELETE', file: item });
    return true;
  }

  public getPendingMutations(): Array<{ action: 'CREATE' | 'UPDATE' | 'DELETE'; file: OfflineFileObject }> {
    return [...this.mutationQueue];
  }

  public async markSynced(id: string, serverVersion: number): Promise<void> {
    const item = this.cache.get(id);
    if (item) {
      item.isSynced = true;
      item.version = serverVersion;
    }
    this.mutationQueue = this.mutationQueue.filter(m => m.file.id !== id);
  }
}
