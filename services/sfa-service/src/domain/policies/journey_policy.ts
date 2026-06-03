export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface OutletDistance {
  outletId: string;
  name: string;
  location: GeoPoint;
  distanceMeters: number;
}

export class JourneyPolicy {
  /**
   * Calculates the Haversine distance in meters between two geopoints.
   */
  static calculateDistance(p1: GeoPoint, p2: GeoPoint): number {
    const R = 6371000; // Earth radius in meters
    const dLat = (p2.lat - p1.lat) * (Math.PI / 180);
    const dLng = (p2.lng - p1.lng) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(p1.lat * (Math.PI / 180)) *
        Math.cos(p2.lat * (Math.PI / 180)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }

  /**
   * Evaluates if agent visit coordinate is within beat limits (max 50-100 meters).
   */
  static isBeatAdherent(
    agentLoc: GeoPoint,
    outletLoc: GeoPoint,
    maxRadiusMeters = 50
  ): boolean {
    const dist = this.calculateDistance(agentLoc, outletLoc);
    return dist <= maxRadiusMeters;
  }

  /**
   * Recommends detour beat rerouting by sorting unvisited outlets by proximity.
   */
  static suggestReroute(
    agentLoc: GeoPoint,
    unvisitedOutlets: Array<{ id: string; name: string; location: GeoPoint }>
  ): OutletDistance[] {
    const mapped = unvisitedOutlets.map((outlet) => {
      const distanceMeters = this.calculateDistance(agentLoc, outlet.location);
      return {
        outletId: outlet.id,
        name: outlet.name,
        location: outlet.location,
        distanceMeters,
      };
    });

    // Sort by proximity (closest first)
    return mapped.sort((a, b) => a.distanceMeters - b.distanceMeters);
  }
}
