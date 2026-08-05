import { GeoPoint } from '../value-objects/geo-point.js';

export type OutletType = 'kirana' | 'supermarket' | 'pharmacy' | 'general';
export type KycStatus = 'pending' | 'verified' | 'rejected';
export type OutletProfileStatus = 'active' | 'inactive';

export interface OutletProfileProps {
  id: string;
  tenantId: string;
  outletName: string;
  outletType: OutletType;
  ownerName: string;
  ownerPhone: string;
  address: string;
  geoCoords: GeoPoint;
  kycStatus: KycStatus;
  status: OutletProfileStatus;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export class OutletProfile {
  private props: OutletProfileProps;

  private constructor(props: OutletProfileProps) {
    this.props = props;
  }

  static create(input: {
    id: string;
    tenantId: string;
    outletName: string;
    outletType: OutletType;
    ownerName: string;
    ownerPhone: string;
    address: string;
    geoCoords: GeoPoint;
    kycStatus?: KycStatus;
    status?: OutletProfileStatus;
  }): OutletProfile {
    const now = new Date();
    return new OutletProfile({
      ...input,
      kycStatus: input.kycStatus ?? 'pending',
      status: input.status ?? 'active',
      createdAt: now,
      updatedAt: now,
      version: 1,
    });
  }

  static reconstitute(props: OutletProfileProps): OutletProfile {
    return new OutletProfile(props);
  }

  // Accessors
  get id(): string { return this.props.id; }
  get tenantId(): string { return this.props.tenantId; }
  get outletName(): string { return this.props.outletName; }
  get outletType(): OutletType { return this.props.outletType; }
  get ownerName(): string { return this.props.ownerName; }
  get ownerPhone(): string { return this.props.ownerPhone; }
  get address(): string { return this.props.address; }
  get geoCoords(): GeoPoint { return this.props.geoCoords; }
  get kycStatus(): KycStatus { return this.props.kycStatus; }
  get status(): OutletProfileStatus { return this.props.status; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get version(): number { return this.props.version; }

  // State transitions and mutations
  activate(): void {
    this.props.status = 'active';
    this.props.updatedAt = new Date();
  }

  deactivate(): void {
    this.props.status = 'inactive';
    this.props.updatedAt = new Date();
  }

  updateKycStatus(kycStatus: KycStatus): void {
    this.props.kycStatus = kycStatus;
    this.props.updatedAt = new Date();
  }

  updateDetails(details: {
    outletName?: string;
    outletType?: OutletType;
    ownerName?: string;
    ownerPhone?: string;
    address?: string;
    geoCoords?: GeoPoint;
  }): void {
    if (details.outletName !== undefined) this.props.outletName = details.outletName;
    if (details.outletType !== undefined) this.props.outletType = details.outletType;
    if (details.ownerName !== undefined) this.props.ownerName = details.ownerName;
    if (details.ownerPhone !== undefined) this.props.ownerPhone = details.ownerPhone;
    if (details.address !== undefined) this.props.address = details.address;
    if (details.geoCoords !== undefined) this.props.geoCoords = details.geoCoords;
    this.props.updatedAt = new Date();
  }

  incrementVersion(): void {
    this.props.version += 1;
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.props.id,
      tenantId: this.props.tenantId,
      outletName: this.props.outletName,
      outletType: this.props.outletType,
      ownerName: this.props.ownerName,
      ownerPhone: this.props.ownerPhone,
      address: this.props.address,
      geoCoords: this.props.geoCoords.toJSON(),
      kycStatus: this.props.kycStatus,
      status: this.props.status,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
      version: this.props.version,
    };
  }
}
