export interface LocalOutlet {
  id: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  syncStatus: 'synced' | 'pending_insert' | 'pending_update' | 'pending_delete';
}

export interface LocalOrder {
  id: string;
  outletId: string;
  totalAmount: number;
  status: 'draft' | 'submitted';
  createdAt: number;
  syncStatus: 'synced' | 'pending_insert' | 'pending_update' | 'pending_delete';
}

export interface LocalVisit {
  id: string;
  outletId: string;
  checkInTime: number;
  checkOutTime?: number;
  syncStatus: 'synced' | 'pending_insert' | 'pending_update' | 'pending_delete';
}
