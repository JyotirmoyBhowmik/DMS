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

export interface LocalAttendance {
  id: string;
  agentId: string;
  date: string;
  checkInTime?: number;
  checkOutTime?: number;
  status: 'absent' | 'checked_in' | 'checked_out' | 'leave';
  leaveType?: string;
  version: number;
  syncStatus: 'synced' | 'pending_insert' | 'pending_update' | 'pending_delete';
}

export interface LocalGeoCheckIn {
  id: string;
  tenantId: string;
  agentId: string;
  outletId: string;
  visitId?: string;
  checkInTime: number;
  checkOutTime?: number;
  checkInLat: number;
  checkInLng: number;
  checkOutLat?: number;
  checkOutLng?: number;
  distanceFromOutlet: number;
  isWithinGeofence: boolean;
  spoofingDetected: boolean;
  deviceInfo: { model: string; os: string; batteryLevel: number };
  version: number;
  syncStatus: 'synced' | 'pending_insert' | 'pending_update' | 'pending_delete';
}

