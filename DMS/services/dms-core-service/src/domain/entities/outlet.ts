/**
 * Outlet Domain Entity.
 * Represents a retail shop with physical GPS geofence bounds, channel types, and status transitions.
 */

export type OutletStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
export type OutletChannelType = 'RETAIL' | 'WHOLESALE' | 'KEY_ACCOUNT';

export interface OutletProps {
  id: string;
  tenantId: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters?: number;
  status?: OutletStatus;
  channelType?: OutletChannelType;
  address?: string;
  ownerName?: string;
  ownerPhone?: string;
  distributorId?: string;
  version?: number;
}

export class Outlet {
  public readonly id: string;
  public readonly tenantId: string;
  private _name: string;
  private _latitude: number;
  private _longitude: number;
  private _radiusMeters: number;
  private _status: OutletStatus;
  private _channelType: OutletChannelType;
  private _address?: string;
  private _ownerName?: string;
  private _ownerPhone?: string;
  private _distributorId?: string;
  private _version: number;

  public readonly domainEvents: Array<{ type: string; payload: any }> = [];

  constructor(props: OutletProps) {
    if (!props.id || !props.tenantId || !props.name) {
      throw new Error('Outlet must have id, tenantId, and name');
    }
    if (props.latitude < -90 || props.latitude > 90) {
      throw new Error('Latitude must be between -90 and 90');
    }
    if (props.longitude < -180 || props.longitude > 180) {
      throw new Error('Longitude must be between -180 and 180');
    }

    this.id = props.id;
    this.tenantId = props.tenantId;
    this._name = props.name;
    this._latitude = props.latitude;
    this._longitude = props.longitude;
    this._radiusMeters = props.radiusMeters ?? 50;
    this._status = props.status ?? 'ACTIVE';
    this._channelType = props.channelType ?? 'RETAIL';
    this._address = props.address;
    this._ownerName = props.ownerName;
    this._ownerPhone = props.ownerPhone;
    this._distributorId = props.distributorId;
    this._version = props.version ?? 1;
  }

  get name(): string { return this._name; }
  get latitude(): number { return this._latitude; }
  get longitude(): number { return this._longitude; }
  get radiusMeters(): number { return this._radiusMeters; }
  get status(): OutletStatus { return this._status; }
  get channelType(): OutletChannelType { return this._channelType; }
  get address(): string | undefined { return this._address; }
  get ownerName(): string | undefined { return this._ownerName; }
  get ownerPhone(): string | undefined { return this._ownerPhone; }
  get distributorId(): string | undefined { return this._distributorId; }
  get version(): number { return this._version; }

  static create(props: OutletProps): Outlet {
    const outlet = new Outlet(props);
    outlet.domainEvents.push({
      type: 'distributor.outlet.created',
      payload: { outletId: outlet.id, name: outlet.name, tenantId: outlet.tenantId }
    });
    return outlet;
  }

  updateDetails(props: Partial<Pick<OutletProps, 'name' | 'latitude' | 'longitude' | 'radiusMeters' | 'channelType' | 'status' | 'address' | 'ownerName' | 'ownerPhone'>>): void {
    if (props.name) this._name = props.name;
    if (props.latitude !== undefined) {
      if (props.latitude < -90 || props.latitude > 90) throw new Error('Latitude out of bounds');
      this._latitude = props.latitude;
    }
    if (props.longitude !== undefined) {
      if (props.longitude < -180 || props.longitude > 180) throw new Error('Longitude out of bounds');
      this._longitude = props.longitude;
    }
    if (props.radiusMeters !== undefined) this._radiusMeters = props.radiusMeters;
    if (props.channelType) this._channelType = props.channelType;
    if (props.status) this._status = props.status;
    if (props.address !== undefined) this._address = props.address;
    if (props.ownerName !== undefined) this._ownerName = props.ownerName;
    if (props.ownerPhone !== undefined) this._ownerPhone = props.ownerPhone;

    this._version++;
    this.domainEvents.push({
      type: 'distributor.outlet.updated',
      payload: { outletId: this.id, version: this._version }
    });
  }


  updateStatus(newStatus: OutletStatus): void {
    if (this._status === newStatus) return;
    this._status = newStatus;
    this._version++;
    this.domainEvents.push({
      type: 'distributor.outlet.status_changed',
      payload: { outletId: this.id, status: newStatus, version: this._version }
    });
  }

  /**
   * Haversine formula to compute geodesic distance in meters and check geofence entry compliance.
   */
  isWithinGeofence(latitude: number, longitude: number): { compliant: boolean; distanceMeters: number } {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (this._latitude * Math.PI) / 180;
    const phi2 = (latitude * Math.PI) / 180;
    const deltaPhi = ((latitude - this._latitude) * Math.PI) / 180;
    const deltaLambda = ((longitude - this._longitude) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distanceMeters = Math.round(R * c);
    return {
      compliant: distanceMeters <= this._radiusMeters,
      distanceMeters,
    };
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      name: this._name,
      latitude: this._latitude,
      longitude: this._longitude,
      radiusMeters: this._radiusMeters,
      status: this._status,
      channelType: this._channelType,
      address: this._address,
      ownerName: this._ownerName,
      ownerPhone: this._ownerPhone,
      distributorId: this._distributorId,
      version: this._version,
    };
  }
}
