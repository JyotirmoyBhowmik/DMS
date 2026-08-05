/**
 * Immutable GeoPoint value object with Haversine distance calculation.
 * Validates latitude [-90, 90] and longitude [-180, 180].
 */
export class GeoPoint {
  public readonly latitude: number;
  public readonly longitude: number;

  private constructor(latitude: number, longitude: number) {
    if (latitude < -90 || latitude > 90) {
      throw new Error(`Invalid latitude: ${latitude}. Must be between -90 and 90.`);
    }
    if (longitude < -180 || longitude > 180) {
      throw new Error(`Invalid longitude: ${longitude}. Must be between -180 and 180.`);
    }
    this.latitude = latitude;
    this.longitude = longitude;
  }

  static create(latitude: number, longitude: number): GeoPoint {
    return new GeoPoint(latitude, longitude);
  }

  /**
   * Compute the great-circle distance to another point using the Haversine formula.
   * @returns distance in metres
   */
  distanceTo(other: GeoPoint): number {
    const EARTH_RADIUS_M = 6_371_000;
    const toRad = (deg: number): number => (deg * Math.PI) / 180;

    const dLat = toRad(other.latitude - this.latitude);
    const dLon = toRad(other.longitude - this.longitude);
    const lat1 = toRad(this.latitude);
    const lat2 = toRad(other.latitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS_M * c;
  }

  /** Distance in kilometres, rounded to 2 decimal places. */
  distanceToKm(other: GeoPoint): number {
    return Math.round((this.distanceTo(other) / 1000) * 100) / 100;
  }

  equals(other: GeoPoint): boolean {
    return this.latitude === other.latitude && this.longitude === other.longitude;
  }

  toString(): string {
    return `(${this.latitude}, ${this.longitude})`;
  }

  toJSON(): { latitude: number; longitude: number } {
    return { latitude: this.latitude, longitude: this.longitude };
  }
}
