export interface MobileReturnRecord {
  id: string;
  tenantId: string;
  returnNumber: string;
  outletId: string;
  warehouseId: string;
  skuId: string;
  quantity: number;
  reason: string;
  totalAmountCents: number;
  status: string;
  version: number;
  syncedAt?: string;
  isPendingSync?: boolean;
}

export class ReturnSyncHandler {
  private static localCache = new Map<string, MobileReturnRecord>();

  static clearLocalCache(): void {
    this.localCache.clear();
  }

  async queueLocalMutation(record: MobileReturnRecord): Promise<void> {
    console.log(`[ReturnSyncHandler] Queuing local offline return mutation on mobile device: ${record.id} (${record.returnNumber})`);
    record.isPendingSync = true;
    ReturnSyncHandler.localCache.set(record.id, record);
  }

  async syncPendingMutations(remoteSyncFn: (record: MobileReturnRecord) => Promise<any>): Promise<{ syncedCount: number; errors: any[] }> {
    console.log('[ReturnSyncHandler] Initiating mobile offline sync with cloud backend');
    const pending = Array.from(ReturnSyncHandler.localCache.values()).filter(r => r.isPendingSync);
    let syncedCount = 0;
    const errors: any[] = [];

    for (const record of pending) {
      try {
        await remoteSyncFn(record);
        record.isPendingSync = false;
        record.syncedAt = new Date().toISOString();
        syncedCount++;
      } catch (err: any) {
        console.error(`[ReturnSyncHandler] Sync failed for offline record ${record.id}: ${err.message}`);
        errors.push({ id: record.id, error: err.message });
      }
    }

    return { syncedCount, errors };
  }
}
