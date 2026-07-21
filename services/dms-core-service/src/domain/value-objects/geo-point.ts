/**
 * Immutable GeoPoint value object representing geographic coordinates.
 * Coordinates are validated upon construction to be within proper ranges.
 */
export class GeoPoint {
  public readonly latitude: number;
  public readonly longitude: number;

  constructor(latitude: number, longitude: number) {
    if (latitude < -90 || latitude > 90) {
      throw new Error(`Invalid latitude value: ${latitude}. Must be between -90 and 90.`);
    }
    if (longitude < -180 || longitude > 180) {
      throw new Error(`Invalid longitude value: ${longitude}. Must be between -180 and 180.`);
    }
    this.latitude = latitude;
    this.longitude = longitude;
  }

  /**
   * Calculates the orthodromic distance in meters to another GeoPoint using the Haversine formula.
   */
  distanceTo(other: GeoPoint): number {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (this.latitude * Math.PI) / 180;
    const phi2 = (other.latitude * Math.PI) / 180;
    const deltaPhi = ((other.latitude - this.latitude) * Math.PI) / 180;
    const deltaLambda = ((other.longitude - this.longitude) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  equals(other: GeoPoint): boolean {
    return this.latitude === other.latitude && this.longitude === other.longitude;
  }

  toJSON() {
    return {
      latitude: this.latitude,
      longitude: this.longitude,
    };
  }
}
