import { GeoPoint } from '../value-objects/geo-point';

/**
 * OutletCensus domain entity.
 * Captures field data for retail outlets: classification, KYC, trade info,
 * competitor presence. State machine: draft → submitted → verified → approved | rejected.
 */
export type OutletType = 'kirana' | 'supermarket' | 'pharmacy' | 'general';
export type KycStatus = 'pending' | 'verified' | 'rejected';
export type OutletCensusStatus = 'draft' | 'submitted' | 'verified' | 'approved' | 'rejected';

export interface OutletCensusProps {
  id: string;
  tenantId: string;
  outletId: string;
  agentId: string;
  censusDate: string; // ISO date YYYY-MM-DD
  outletName: string;
  outletType: OutletType;
  ownerName: string;
  ownerPhone: string;
  address: string;
  geoCoords: GeoPoint;
  photoUrls: string[];
  kycStatus: KycStatus;
  gstin: string | null;
  panNumber: string | null;
  tradeCategory: string;
  annualTurnoverEstimate: number; // smallest currency unit
  competitorPresence: string[];
  status: OutletCensusStatus;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export class OutletCensus {
  private props: OutletCensusProps;

  private constructor(props: OutletCensusProps) {
    this.props = {
      ...props,
      photoUrls: [...props.photoUrls],
      competitorPresence: [...props.competitorPresence],
    };
  }

  static create(input: {
    id: string;
    tenantId: string;
    outletId: string;
    agentId: string;
    censusDate: string;
    outletName: string;
    outletType: OutletType;
    ownerName: string;
    ownerPhone: string;
    address: string;
    geoCoords: GeoPoint;
    photoUrls?: string[];
    gstin?: string;
    panNumber?: string;
    tradeCategory: string;
    annualTurnoverEstimate?: number;
    competitorPresence?: string[];
  }): OutletCensus {
    const now = new Date();
    return new OutletCensus({
      ...input,
      photoUrls: input.photoUrls ?? [],
      kycStatus: 'pending',
      gstin: input.gstin ?? null,
      panNumber: input.panNumber ?? null,
      annualTurnoverEstimate: input.annualTurnoverEstimate ?? 0,
      competitorPresence: input.competitorPresence ?? [],
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      version: 0,
    });
  }

  static reconstitute(props: OutletCensusProps): OutletCensus {
    return new OutletCensus(props);
  }

  // ── Accessors ──────────────────────────────────────────────────
  get id(): string { return this.props.id; }
  get tenantId(): string { return this.props.tenantId; }
  get outletId(): string { return this.props.outletId; }
  get agentId(): string { return this.props.agentId; }
  get censusDate(): string { return this.props.censusDate; }
  get outletName(): string { return this.props.outletName; }
  get outletType(): OutletType { return this.props.outletType; }
  get ownerName(): string { return this.props.ownerName; }
  get ownerPhone(): string { return this.props.ownerPhone; }
  get address(): string { return this.props.address; }
  get geoCoords(): GeoPoint { return this.props.geoCoords; }
  get photoUrls(): ReadonlyArray<string> { return this.props.photoUrls; }
  get kycStatus(): KycStatus { return this.props.kycStatus; }
  get gstin(): string | null { return this.props.gstin; }
  get panNumber(): string | null { return this.props.panNumber; }
  get tradeCategory(): string { return this.props.tradeCategory; }
  get annualTurnoverEstimate(): number { return this.props.annualTurnoverEstimate; }
  get competitorPresence(): ReadonlyArray<string> { return this.props.competitorPresence; }
  get status(): OutletCensusStatus { return this.props.status; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get version(): number { return this.props.version; }

  // ── State Transitions ─────────────────────────────────────────
  submit(): void {
    if (this.props.status !== 'draft') {
      throw new Error(`Cannot submit census from state: ${this.props.status}`);
    }
    this.props.status = 'submitted';
    this.props.updatedAt = new Date();
  }

  verify(): void {
    if (this.props.status !== 'submitted') {
      throw new Error(`Cannot verify census from state: ${this.props.status}`);
    }
    this.props.status = 'verified';
    this.props.updatedAt = new Date();
  }

  approve(): void {
    if (this.props.status !== 'verified') {
      throw new Error(`Cannot approve census from state: ${this.props.status}`);
    }
    this.props.status = 'approved';
    this.props.updatedAt = new Date();
  }

  reject(): void {
    if (this.props.status !== 'submitted' && this.props.status !== 'verified') {
      throw new Error(`Cannot reject census from state: ${this.props.status}`);
    }
    this.props.status = 'rejected';
    this.props.updatedAt = new Date();
  }

  // ── Mutations ──────────────────────────────────────────────────
  updateKyc(kycStatus: KycStatus, gstin?: string, panNumber?: string): void {
    this.props.kycStatus = kycStatus;
    if (gstin !== undefined) this.props.gstin = gstin;
    if (panNumber !== undefined) this.props.panNumber = panNumber;
    this.props.updatedAt = new Date();
  }

  addPhoto(url: string): void {
    this.props.photoUrls.push(url);
    this.props.updatedAt = new Date();
  }

  updateCompetitorPresence(competitors: string[]): void {
    this.props.competitorPresence = [...competitors];
    this.props.updatedAt = new Date();
  }

  incrementVersion(): void {
    this.props.version += 1;
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.props.id,
      tenantId: this.props.tenantId,
      outletId: this.props.outletId,
      agentId: this.props.agentId,
      censusDate: this.props.censusDate,
      outletName: this.props.outletName,
      outletType: this.props.outletType,
      ownerName: this.props.ownerName,
      ownerPhone: this.props.ownerPhone,
      address: this.props.address,
      geoCoords: this.props.geoCoords.toJSON(),
      photoUrls: [...this.props.photoUrls],
      kycStatus: this.props.kycStatus,
      gstin: this.props.gstin,
      panNumber: this.props.panNumber,
      tradeCategory: this.props.tradeCategory,
      annualTurnoverEstimate: this.props.annualTurnoverEstimate,
      competitorPresence: [...this.props.competitorPresence],
      status: this.props.status,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
      version: this.props.version,
    };
  }
}
