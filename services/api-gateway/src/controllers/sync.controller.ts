import { RequirePermissions } from '@dms/pkg-rbac';
import { SyncRequest, SyncResponse, PushRequest, PushResponse } from '@dms/pkg-mobile-sync';

export class SyncController {
  @RequirePermissions('sync:read')
  async pull(req: SyncRequest): Promise<SyncResponse> {
    // Mock SyncResponse implementation
    return {
      orders: { changed: [], deleted: [] },
      visits: { changed: [], deleted: [] },
      outlets: { changed: [], deleted: [] },
      serverTimestamp: Date.now()
    };
  }

  @RequirePermissions('sync:write')
  async push(req: PushRequest): Promise<PushResponse> {
    // Mock PushResponse implementation
    return {
      success: true,
      serverTimestamp: Date.now()
    };
  }
}
