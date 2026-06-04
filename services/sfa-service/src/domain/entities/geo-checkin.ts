import { GeoPoint } from '../value-objects/geo-point';

/**
 * GeoCheckIn domain entity.
 * Tracks GPS-verified check-ins at outlets with geofence validation,
 * spoofing detection, and minimum visit duration enforcement.
 */
export interface DeviceInfo {
  model: string;
  os: string;
  batteryLevel: number;
}

export interface GeoCheckInProps {
  id: string;
  tenantId: string;
  agentId: string;
  outletId: string;
  visitId: string | null;
  checkInTime: Date;
  checkOutTime: Date | null;
  checkInCoords: GeoPoint;
  checkOutCoords: GeoPoint | null;
  distanceFromOutlet: number; // metres
  isWithinGeofence: boolean;
  spoofingDetected: boolean;
  deviceInfo: DeviceInfo;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

const DEFAULT_GEOFENCE_RADIUS_M = 50;
const MIN_VISIT_DURATION_MS = 2 * 60_000; // 2 minutes

export class GeoCheckIn {
  private props: GeoCheckInProps;

  private constructor(props: GeoCheckInProps) {
    this.props = { ...props, deviceInfo: { ...props.deviceInfo } };
  }

  static create(input: {
    id: string;
    tenantId: string;
    agentId: string;
    outletId: string;
    visitId?: string;
    checkInCoords: GeoPoint;
    outletCoords: GeoPoint;
    deviceInfo: DeviceInfo;
    geofenceRadiusM?: number;
    spoofingDetected?: boolean;
  }): GeoCheckIn {
    const radius = input.geofenceRadiusM ?? DEFAULT_GEOFENCE_RADIUS_M;
    const distance = input.checkInCoords.distanceTo(input.outletCoords);
    const isWithinGeofence = distance <= radius;
    const now = new Date();

    return new GeoCheckIn({
      id: input.id,
      tenantId: input.tenantId,
      agentId: input.agentId,
      outletId: input.outletId,
      visitId: input.visitId ?? null,
      checkInTime: now,
      checkOutTime: null,
      checkInCoords: input.checkInCoords,
      checkOutCoords: null,
      distanceFromOutlet: Math.round(distance * 100) / 100,
      isWithinGeofence,
      spoofingDetected: input.spoofingDetected ?? false,
      deviceInfo: { ...input.deviceInfo },
      createdAt: now,
      updatedAt: now,
      version: 0,
    });
  }

  static reconstitute(props: GeoCheckInProps): GeoCheckIn {
    return new GeoCheckIn(props);
  }

  // ── Accessors ──────────────────────────────────────────────────
  get id(): string { return this.props.id; }
  get tenantId(): string { return this.props.tenantId; }
  get agentId(): string { return this.props.agentId; }
  get outletId(): string { return this.props.outletId; }
  get visitId(): string | null { return this.props.visitId; }
  get checkInTime(): Date { return this.props.checkInTime; }
  get checkOutTime(): Date | null { return this.props.checkOutTime; }
  get checkInCoords(): GeoPoint { return this.props.checkInCoords; }
  get checkOutCoords(): GeoPoint | null { return this.props.checkOutCoords; }
  get distanceFromOutlet(): number { return this.props.distanceFromOutlet; }
  get isWithinGeofence(): boolean { return this.props.isWithinGeofence; }
  get spoofingDetected(): boolean { return this.props.spoofingDetected; }
  get deviceInfo(): Readonly<DeviceInfo> { return this.props.deviceInfo; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get version(): number { return this.props.version; }

  // ── Mutations ──────────────────────────────────────────────────
  checkOut(coords: GeoPoint): void {
    if (this.props.checkOutTime !== null) {
      throw new Error('Already checked out');
    }
    const now = new Date();
    // Business rule: minimum 2-minute visit duration
    const elapsed = now.getTime() - this.props.checkInTime.getTime();
    if (elapsed < MIN_VISIT_DURATION_MS) {
      throw new Error(`Minimum visit duration is 2 minutes. Elapsed: ${Math.round(elapsed / 1000)}s`);
    }
    this.props.checkOutTime = now;
    this.props.checkOutCoords = coords;
    this.props.updatedAt = now;
  }

  flagSpoofing(): void {
    this.props.spoofingDetected = true;
    this.props.updatedAt = new Date();
  }

  /** Duration in minutes. Returns null if not checked out. */
  durationMinutes(): number | null {
    if (!this.props.checkOutTime) return null;
    return Math.round(
      (this.props.checkOutTime.getTime() - this.props.checkInTime.getTime()) / 60_000,
    );
  }

  incrementVersion(): void {
    this.props.version += 1;
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.props.id,
      tenantId: this.props.tenantId,
      agentId: this.props.agentId,
      outletId: this.props.outletId,
      visitId: this.props.visitId,
      checkInTime: this.props.checkInTime.toISOString(),
      checkOutTime: this.props.checkOutTime?.toISOString() ?? null,
      checkInCoords: this.props.checkInCoords.toJSON(),
      checkOutCoords: this.props.checkOutCoords?.toJSON() ?? null,
      distanceFromOutlet: this.props.distanceFromOutlet,
      isWithinGeofence: this.props.isWithinGeofence,
      spoofingDetected: this.props.spoofingDetected,
      deviceInfo: { ...this.props.deviceInfo },
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
      version: this.props.version,
    };
  }
}
