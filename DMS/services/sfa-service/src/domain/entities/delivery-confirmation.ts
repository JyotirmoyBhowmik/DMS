import { GeoPoint } from '../value-objects/geo-point.js';
import { InvalidDeliveryStateError } from '../errors/domain-error.js';

export type DeliveryStatus = 'FULL' | 'PARTIAL' | 'REJECTED';

export interface DeliveryConfirmationProps {
  id: string;
  tenantId: string;
  orderId: string;
  deliveredAt: Date;
  receivedBy: string;
  signaturePhotoUrl?: string;
  gpsLocation: GeoPoint;
  status: DeliveryStatus;
  rejectionReason?: string;
  version: number;
}

export class DeliveryConfirmation {
  private props: DeliveryConfirmationProps;

  private constructor(props: DeliveryConfirmationProps) {
    this.props = { ...props };
    this.validate();
  }

  static create(input: {
    id: string;
    tenantId: string;
    orderId: string;
    deliveredAt: Date;
    receivedBy: string;
    signaturePhotoUrl?: string;
    gpsLocation: GeoPoint;
    status: DeliveryStatus;
    rejectionReason?: string;
  }): DeliveryConfirmation {
    return new DeliveryConfirmation({
      ...input,
      version: 1,
    });
  }

  static reconstitute(props: DeliveryConfirmationProps): DeliveryConfirmation {
    return new DeliveryConfirmation(props);
  }

  get id(): string { return this.props.id; }
  get tenantId(): string { return this.props.tenantId; }
  get orderId(): string { return this.props.orderId; }
  get deliveredAt(): Date { return this.props.deliveredAt; }
  get receivedBy(): string { return this.props.receivedBy; }
  get signaturePhotoUrl(): string | undefined { return this.props.signaturePhotoUrl; }
  get gpsLocation(): GeoPoint { return this.props.gpsLocation; }
  get status(): DeliveryStatus { return this.props.status; }
  get rejectionReason(): string | undefined { return this.props.rejectionReason; }
  get version(): number { return this.props.version; }

  incrementVersion(): void {
    this.props.version += 1;
  }

  // Domain state mutations
  confirmFullDelivery(receivedBy: string, signaturePhotoUrl?: string): void {
    if (this.props.status === 'FULL') {
      // No-op or idempotent
      return;
    }
    // All transitions to FULL are allowed
    this.props.status = 'FULL';
    this.props.receivedBy = receivedBy;
    this.props.signaturePhotoUrl = signaturePhotoUrl;
    this.props.rejectionReason = undefined;
    this.validate();
  }

  confirmPartialDelivery(receivedBy: string, signaturePhotoUrl?: string): void {
    if (this.props.status === 'FULL') {
      throw new InvalidDeliveryStateError(this.props.status, 'PARTIAL');
    }
    this.props.status = 'PARTIAL';
    this.props.receivedBy = receivedBy;
    this.props.signaturePhotoUrl = signaturePhotoUrl;
    this.props.rejectionReason = undefined;
    this.validate();
  }

  rejectDelivery(rejectionReason: string, receivedBy: string): void {
    if (this.props.status === 'FULL') {
      throw new InvalidDeliveryStateError(this.props.status, 'REJECTED');
    }
    this.props.status = 'REJECTED';
    this.props.receivedBy = receivedBy;
    this.props.rejectionReason = rejectionReason;
    this.validate();
  }

  private validate(): void {
    // ID formats check
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(this.props.id)) {
      throw new Error('Invalid DeliveryConfirmation ID format');
    }
    if (!uuidRegex.test(this.props.tenantId)) {
      throw new Error('Invalid tenantId format');
    }
    if (!uuidRegex.test(this.props.orderId)) {
      throw new Error('Invalid orderId format');
    }

    if (!this.props.receivedBy || this.props.receivedBy.trim().length === 0) {
      throw new Error('receivedBy cannot be empty');
    }

    if (this.props.status === 'REJECTED') {
      if (!this.props.rejectionReason || this.props.rejectionReason.trim().length === 0) {
        throw new Error('rejectionReason is required for status REJECTED');
      }
    }

    // Coordinates ranges validation
    const lat = this.props.gpsLocation.latitude;
    const lon = this.props.gpsLocation.longitude;
    if (lat < -90 || lat > 90) {
      throw new Error('Latitude must be between -90 and 90');
    }
    if (lon < -180 || lon > 180) {
      throw new Error('Longitude must be between -180 and 180');
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.props.id,
      tenantId: this.props.tenantId,
      orderId: this.props.orderId,
      deliveredAt: this.props.deliveredAt.toISOString(),
      receivedBy: this.props.receivedBy,
      signaturePhotoUrl: this.props.signaturePhotoUrl,
      gpsLocation: this.props.gpsLocation.toJSON(),
      status: this.props.status,
      rejectionReason: this.props.rejectionReason,
      version: this.props.version,
    };
  }
}
