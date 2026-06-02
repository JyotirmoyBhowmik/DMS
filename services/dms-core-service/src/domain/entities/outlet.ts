/**
 * Outlet Domain Entity.
 * Represents a retail shop with physical GPS geofence bounds.
 */
export class Outlet {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly name: string;
  public readonly latitude: number;
  public readonly longitude: number;
  public readonly radiusMeters: number;

  constructor(id: string, tenantId: string, name: string, latitude: number, longitude: number, radiusMeters = 50) {
    this.id = id;
    this.tenantId = tenantId;
    this.name = name;
    this.latitude = latitude;
    this.longitude = longitude;
    this.radiusMeters = radiusMeters;
  }

  static create(props: {
    id: string;
    tenantId: string;
    name: string;
    latitude: number;
    longitude: number;
    radiusMeters?: number;
  }): Outlet {
    return new Outlet(props.id, props.tenantId, props.name, props.latitude, props.longitude, props.radiusMeters);
  }

  /**
   * Haversine formula to compute geodesic distance in meters and check geofence entry compliance.
   */
  isWithinGeofence(latitude: number, longitude: number): { compliant: boolean; distanceMeters: number } {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (this.latitude * Math.PI) / 180;
    const phi2 = (latitude * Math.PI) / 180;
    const deltaPhi = ((latitude - this.latitude) * Math.PI) / 180;
    const deltaLambda = ((longitude - this.longitude) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distanceMeters = Math.round(R * c);
    return {
      compliant: distanceMeters <= this.radiusMeters,
      distanceMeters,
    };
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      name: this.name,
      latitude: this.latitude,
      longitude: this.longitude,
      radiusMeters: this.radiusMeters,
    };
  }
}
