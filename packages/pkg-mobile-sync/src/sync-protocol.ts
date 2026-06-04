export interface SyncRequest {
  lastSyncTimestamp: number;
}

export interface SyncResponse {
  orders: {
    changed: any[];
    deleted: string[];
  };
  visits: {
    changed: any[];
    deleted: string[];
  };
  outlets: {
    changed: any[];
    deleted: string[];
  };
  serverTimestamp: number;
}

export interface PushRequest {
  orders: any[];
  visits: any[];
  outlets: any[];
  lastSyncTimestamp: number;
}

export interface PushResponse {
  success: boolean;
  serverTimestamp: number;
}
