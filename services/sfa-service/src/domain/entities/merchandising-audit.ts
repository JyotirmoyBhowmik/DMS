import { Money } from '../value-objects/money.js';
import { InvalidAuditStateError } from '../errors/domain-error.js';

export interface ShelfPhoto {
  photoUrl: string;
  category: string;
  timestamp: Date;
}

export interface BrandShelfShare {
  brand: string;
  percentage: number;
}

export interface PricingAuditItem {
  skuId: string;
  listedPrice: Money;
  actualPrice: Money;
}

export type MerchandisingAuditStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export interface MerchandisingAuditProps {
  id: string;
  tenantId: string;
  agentId: string;
  outletId: string;
  visitId: string | null;
  auditDate: string; // ISO date YYYY-MM-DD
  shelfPhotos: ShelfPhoto[];
  planogramCompliance: number; // 0-100
  shelfShareByBrand: BrandShelfShare[];
  outOfStockSkus: string[];
  pricingAudit: PricingAuditItem[];
  displayScore: number; // 0-100
  notes: string | null;
  status: MerchandisingAuditStatus;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export class MerchandisingAudit {
  private props: MerchandisingAuditProps;

  private constructor(props: MerchandisingAuditProps) {
    this.props = {
      ...props,
      shelfPhotos: props.shelfPhotos.map((p) => ({ ...p, timestamp: new Date(p.timestamp) })),
      shelfShareByBrand: props.shelfShareByBrand.map((s) => ({ ...s })),
      outOfStockSkus: [...props.outOfStockSkus],
      pricingAudit: props.pricingAudit.map((p) => ({
        skuId: p.skuId,
        listedPrice: p.listedPrice,
        actualPrice: p.actualPrice,
      })),
    };
  }

  static create(input: {
    id: string;
    tenantId: string;
    agentId: string;
    outletId: string;
    visitId?: string | null;
    auditDate: string;
    shelfPhotos?: ShelfPhoto[];
    planogramCompliance?: number;
    shelfShareByBrand?: BrandShelfShare[];
    outOfStockSkus?: string[];
    pricingAudit?: PricingAuditItem[];
    displayScore?: number;
    notes?: string | null;
    status?: MerchandisingAuditStatus;
  }): MerchandisingAudit {
    // 1. Invariants validation
    if (!input.id || input.id.trim().length === 0) throw new Error('ID cannot be empty');
    if (!input.tenantId || input.tenantId.trim().length === 0) throw new Error('tenantId cannot be empty');
    if (!input.agentId || input.agentId.trim().length === 0) throw new Error('agentId cannot be empty');
    if (!input.outletId || input.outletId.trim().length === 0) throw new Error('outletId cannot be empty');

    const compliance = input.planogramCompliance ?? 0;
    const score = input.displayScore ?? 0;

    if (compliance < 0 || compliance > 100) {
      throw new Error(`Planogram compliance must be 0-100, got: ${compliance}`);
    }
    if (score < 0 || score > 100) {
      throw new Error(`Display score must be 0-100, got: ${score}`);
    }

    if (input.shelfPhotos) {
      for (const photo of input.shelfPhotos) {
        if (!photo.photoUrl || photo.photoUrl.trim().length === 0) {
          throw new Error('Photo url cannot be empty');
        }
        if (!photo.category || photo.category.trim().length === 0) {
          throw new Error('Photo category cannot be empty');
        }
      }
    }

    if (input.shelfShareByBrand) {
      let total = 0;
      for (const share of input.shelfShareByBrand) {
        if (share.percentage < 0 || share.percentage > 100) {
          throw new Error('Brand shelf share percentage must be between 0 and 100');
        }
        total += share.percentage;
      }
      if (total > 100) {
        throw new Error('Total shelf share percentage cannot exceed 100%');
      }
    }

    const now = new Date();
    return new MerchandisingAudit({
      id: input.id,
      tenantId: input.tenantId,
      agentId: input.agentId,
      outletId: input.outletId,
      visitId: input.visitId ?? null,
      auditDate: input.auditDate,
      shelfPhotos: input.shelfPhotos ?? [],
      planogramCompliance: compliance,
      shelfShareByBrand: input.shelfShareByBrand ?? [],
      outOfStockSkus: input.outOfStockSkus ?? [],
      pricingAudit: input.pricingAudit ?? [],
      displayScore: score,
      notes: input.notes ?? null,
      status: input.status ?? 'DRAFT',
      createdAt: now,
      updatedAt: now,
      version: 0,
    });
  }

  static reconstitute(props: MerchandisingAuditProps): MerchandisingAudit {
    return new MerchandisingAudit(props);
  }

  // ── Accessors ──────────────────────────────────────────────────
  get id(): string { return this.props.id; }
  get tenantId(): string { return this.props.tenantId; }
  get agentId(): string { return this.props.agentId; }
  get outletId(): string { return this.props.outletId; }
  get visitId(): string | null { return this.props.visitId; }
  get auditDate(): string { return this.props.auditDate; }
  get shelfPhotos(): ReadonlyArray<ShelfPhoto> { return this.props.shelfPhotos; }
  get planogramCompliance(): number { return this.props.planogramCompliance; }
  get shelfShareByBrand(): ReadonlyArray<BrandShelfShare> { return this.props.shelfShareByBrand; }
  get outOfStockSkus(): ReadonlyArray<string> { return this.props.outOfStockSkus; }
  get pricingAudit(): ReadonlyArray<PricingAuditItem> { return this.props.pricingAudit; }
  get displayScore(): number { return this.props.displayScore; }
  get notes(): string | null { return this.props.notes; }
  get status(): MerchandisingAuditStatus { return this.props.status; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get version(): number { return this.props.version; }

  // ── Mutations ──────────────────────────────────────────────────
  addShelfPhoto(photo: ShelfPhoto): void {
    if (this.props.status !== 'DRAFT') {
      throw new Error('Can only mutate audit in DRAFT status');
    }
    if (!photo.photoUrl || photo.photoUrl.trim().length === 0) {
      throw new Error('Photo url cannot be empty');
    }
    this.props.shelfPhotos.push({ ...photo });
    this.props.updatedAt = new Date();
  }

  updatePlanogramCompliance(value: number): void {
    if (this.props.status !== 'DRAFT') {
      throw new Error('Can only mutate audit in DRAFT status');
    }
    if (value < 0 || value > 100) {
      throw new Error(`Planogram compliance must be 0-100, got: ${value}`);
    }
    this.props.planogramCompliance = value;
    this.props.updatedAt = new Date();
  }

  updateShelfShare(shares: BrandShelfShare[]): void {
    if (this.props.status !== 'DRAFT') {
      throw new Error('Can only mutate audit in DRAFT status');
    }
    let total = 0;
    for (const share of shares) {
      if (share.percentage < 0 || share.percentage > 100) {
        throw new Error('Brand shelf share percentage must be between 0 and 100');
      }
      total += share.percentage;
    }
    if (total > 100) {
      throw new Error('Total shelf share percentage cannot exceed 100%');
    }
    this.props.shelfShareByBrand = shares.map((s) => ({ ...s }));
    this.props.updatedAt = new Date();
  }

  addOutOfStockSku(skuId: string): void {
    if (this.props.status !== 'DRAFT') {
      throw new Error('Can only mutate audit in DRAFT status');
    }
    if (!this.props.outOfStockSkus.includes(skuId)) {
      this.props.outOfStockSkus.push(skuId);
      this.props.updatedAt = new Date();
    }
  }

  addPricingAuditItem(item: PricingAuditItem): void {
    if (this.props.status !== 'DRAFT') {
      throw new Error('Can only mutate audit in DRAFT status');
    }
    this.props.pricingAudit.push({ ...item });
    this.props.updatedAt = new Date();
  }

  updateDisplayScore(score: number): void {
    if (this.props.status !== 'DRAFT') {
      throw new Error('Can only mutate audit in DRAFT status');
    }
    if (score < 0 || score > 100) {
      throw new Error(`Display score must be 0-100, got: ${score}`);
    }
    this.props.displayScore = score;
    this.props.updatedAt = new Date();
  }

  updateNotes(notes: string): void {
    if (this.props.status !== 'DRAFT') {
      throw new Error('Can only mutate audit in DRAFT status');
    }
    this.props.notes = notes;
    this.props.updatedAt = new Date();
  }

  // ── State Machine Transitions ──────────────────────────────────
  submit(): void {
    if (this.props.status !== 'DRAFT') {
      throw new InvalidAuditStateError(this.props.status, 'SUBMITTED');
    }
    this.props.status = 'SUBMITTED';
    this.props.updatedAt = new Date();
  }

  approve(): void {
    if (this.props.status !== 'SUBMITTED') {
      throw new InvalidAuditStateError(this.props.status, 'APPROVED');
    }
    this.props.status = 'APPROVED';
    this.props.updatedAt = new Date();
  }

  reject(reason: string): void {
    if (this.props.status !== 'SUBMITTED') {
      throw new InvalidAuditStateError(this.props.status, 'REJECTED');
    }
    if (!reason || reason.trim().length === 0) {
      throw new Error('Rejection reason is required');
    }
    this.props.status = 'REJECTED';
    this.props.notes = reason;
    this.props.updatedAt = new Date();
  }

  /** Price discrepancies: items where actual != listed price */
  priceDiscrepancies(): PricingAuditItem[] {
    return this.props.pricingAudit.filter((p) => p.listedPrice.cents !== p.actualPrice.cents);
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
      auditDate: this.props.auditDate,
      shelfPhotos: this.props.shelfPhotos.map((p) => ({
        photoUrl: p.photoUrl,
        category: p.category,
        timestamp: p.timestamp instanceof Date ? p.timestamp.toISOString() : p.timestamp,
      })),
      planogramCompliance: this.props.planogramCompliance,
      shelfShareByBrand: this.props.shelfShareByBrand.map((s) => ({ ...s })),
      outOfStockSkus: [...this.props.outOfStockSkus],
      pricingAudit: this.props.pricingAudit.map((p) => ({
        skuId: p.skuId,
        listedPrice: p.listedPrice.cents,
        actualPrice: p.actualPrice.cents,
      })),
      displayScore: this.props.displayScore,
      notes: this.props.notes,
      status: this.props.status,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
      version: this.props.version,
    };
  }
}
