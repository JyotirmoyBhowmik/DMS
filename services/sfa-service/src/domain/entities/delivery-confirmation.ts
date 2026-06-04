import { GeoPoint } from '../value-objects/geo-point';

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
      version: 0,
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
