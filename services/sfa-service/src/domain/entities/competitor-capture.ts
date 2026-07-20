import { Money } from '../value-objects/money.js';
import { InvalidCompetitorCaptureStateError } from '../errors/domain-error.js';

export type CompetitorCaptureStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export interface CompetitorCaptureProps {
  id: string;
  tenantId: string;
  agentId: string;
  outletId: string;
  captureDate: string; // ISO date YYYY-MM-DD
  brand: string;
  skuId: string;
  observedPrice: Money;
  promotionDetails: string | null;
  photoUrl: string | null;
  notes: string | null;
  status: CompetitorCaptureStatus;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export class CompetitorCapture {
  private props: CompetitorCaptureProps;

  private constructor(props: CompetitorCaptureProps) {
    this.props = {
      ...props,
      observedPrice: props.observedPrice,
    };
  }

  static create(input: {
    id: string;
    tenantId: string;
    agentId: string;
    outletId: string;
    captureDate: string;
    brand: string;
    skuId: string;
    observedPrice: Money;
    promotionDetails?: string | null;
    photoUrl?: string | null;
    notes?: string | null;
    status?: CompetitorCaptureStatus;
  }): CompetitorCapture {
    // Invariants validation
    if (!input.id || input.id.trim().length === 0) throw new Error('ID cannot be empty');
    if (!input.tenantId || input.tenantId.trim().length === 0) throw new Error('tenantId cannot be empty');
    if (!input.agentId || input.agentId.trim().length === 0) throw new Error('agentId cannot be empty');
    if (!input.outletId || input.outletId.trim().length === 0) throw new Error('outletId cannot be empty');
    if (!input.captureDate || input.captureDate.trim().length === 0) throw new Error('captureDate cannot be empty');
    if (!input.brand || input.brand.trim().length === 0) throw new Error('brand cannot be empty');
    if (!input.skuId || input.skuId.trim().length === 0) throw new Error('skuId cannot be empty');

    if (input.observedPrice.cents < 0) {
      throw new Error(`Observed price cents must be non-negative, got: ${input.observedPrice.cents}`);
    }

    const now = new Date();
    return new CompetitorCapture({
      id: input.id,
      tenantId: input.tenantId,
      agentId: input.agentId,
      outletId: input.outletId,
      captureDate: input.captureDate,
      brand: input.brand,
      skuId: input.skuId,
      observedPrice: input.observedPrice,
      promotionDetails: input.promotionDetails ?? null,
      photoUrl: input.photoUrl ?? null,
      notes: input.notes ?? null,
      status: input.status ?? 'DRAFT',
      createdAt: now,
      updatedAt: now,
      version: 0,
    });
  }

  static reconstitute(props: CompetitorCaptureProps): CompetitorCapture {
    return new CompetitorCapture(props);
  }

  // Getters
  get id(): string { return this.props.id; }
  get tenantId(): string { return this.props.tenantId; }
  get agentId(): string { return this.props.agentId; }
  get outletId(): string { return this.props.outletId; }
  get captureDate(): string { return this.props.captureDate; }
  get brand(): string { return this.props.brand; }
  get skuId(): string { return this.props.skuId; }
  get observedPrice(): Money { return this.props.observedPrice; }
  get promotionDetails(): string | null { return this.props.promotionDetails; }
  get photoUrl(): string | null { return this.props.photoUrl; }
  get notes(): string | null { return this.props.notes; }
  get status(): CompetitorCaptureStatus { return this.props.status; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get version(): number { return this.props.version; }

  // Mutations
  updatePrice(newPrice: Money): void {
    if (this.props.status !== 'DRAFT') {
      throw new Error('Can only mutate competitor capture in DRAFT status');
    }
    if (newPrice.cents < 0) {
      throw new Error(`Observed price cents must be non-negative, got: ${newPrice.cents}`);
    }
    this.props.observedPrice = newPrice;
    this.props.updatedAt = new Date();
  }

  updatePromotion(details: string | null): void {
    if (this.props.status !== 'DRAFT') {
      throw new Error('Can only mutate competitor capture in DRAFT status');
    }
    this.props.promotionDetails = details;
    this.props.updatedAt = new Date();
  }

  updatePhoto(url: string | null): void {
    if (this.props.status !== 'DRAFT') {
      throw new Error('Can only mutate competitor capture in DRAFT status');
    }
    this.props.photoUrl = url;
    this.props.updatedAt = new Date();
  }

  updateNotes(notes: string | null): void {
    if (this.props.status !== 'DRAFT') {
      throw new Error('Can only mutate competitor capture in DRAFT status');
    }
    this.props.notes = notes;
    this.props.updatedAt = new Date();
  }

  // State transitions
  submit(): void {
    if (this.props.status !== 'DRAFT') {
      throw new InvalidCompetitorCaptureStateError(this.props.status, 'SUBMITTED');
    }
    this.props.status = 'SUBMITTED';
    this.props.updatedAt = new Date();
  }

  approve(): void {
    if (this.props.status !== 'SUBMITTED') {
      throw new InvalidCompetitorCaptureStateError(this.props.status, 'APPROVED');
    }
    this.props.status = 'APPROVED';
    this.props.updatedAt = new Date();
  }

  reject(reason: string): void {
    if (this.props.status !== 'SUBMITTED') {
      throw new InvalidCompetitorCaptureStateError(this.props.status, 'REJECTED');
    }
    if (!reason || reason.trim().length === 0) {
      throw new Error('Rejection reason is required');
    }
    this.props.status = 'REJECTED';
    this.props.notes = reason;
    this.props.updatedAt = new Date();
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
      captureDate: this.props.captureDate,
      brand: this.props.brand,
      skuId: this.props.skuId,
      observedPrice: this.props.observedPrice.toJSON(),
      promotionDetails: this.props.promotionDetails,
      photoUrl: this.props.photoUrl,
      notes: this.props.notes,
      status: this.props.status,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
      version: this.props.version,
    };
  }
}
