/**
 * MerchandisingAudit domain entity.
 * Captures shelf compliance, planogram adherence, pricing audits,
 * brand share, and display scoring at retail outlets.
 */
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
  listedPrice: number; // smallest currency unit
  actualPrice: number; // smallest currency unit
}

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
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export class MerchandisingAudit {
  private props: MerchandisingAuditProps;

  private constructor(props: MerchandisingAuditProps) {
    this.props = {
      ...props,
      shelfPhotos: props.shelfPhotos.map((p) => ({ ...p })),
      shelfShareByBrand: props.shelfShareByBrand.map((s) => ({ ...s })),
      outOfStockSkus: [...props.outOfStockSkus],
      pricingAudit: props.pricingAudit.map((p) => ({ ...p })),
    };
  }

  static create(input: {
    id: string;
    tenantId: string;
    agentId: string;
    outletId: string;
    visitId?: string;
    auditDate: string;
    shelfPhotos?: ShelfPhoto[];
    planogramCompliance?: number;
    shelfShareByBrand?: BrandShelfShare[];
    outOfStockSkus?: string[];
    pricingAudit?: PricingAuditItem[];
    displayScore?: number;
    notes?: string;
  }): MerchandisingAudit {
    const compliance = input.planogramCompliance ?? 0;
    const score = input.displayScore ?? 0;
    if (compliance < 0 || compliance > 100) {
      throw new Error(`Planogram compliance must be 0-100, got: ${compliance}`);
    }
    if (score < 0 || score > 100) {
      throw new Error(`Display score must be 0-100, got: ${score}`);
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
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get version(): number { return this.props.version; }

  // ── Mutations ──────────────────────────────────────────────────
  addShelfPhoto(photo: ShelfPhoto): void {
    this.props.shelfPhotos.push({ ...photo });
    this.props.updatedAt = new Date();
  }

  updatePlanogramCompliance(value: number): void {
    if (value < 0 || value > 100) {
      throw new Error(`Planogram compliance must be 0-100, got: ${value}`);
    }
    this.props.planogramCompliance = value;
    this.props.updatedAt = new Date();
  }

  updateShelfShare(shares: BrandShelfShare[]): void {
    this.props.shelfShareByBrand = shares.map((s) => ({ ...s }));
    this.props.updatedAt = new Date();
  }

  addOutOfStockSku(skuId: string): void {
    if (!this.props.outOfStockSkus.includes(skuId)) {
      this.props.outOfStockSkus.push(skuId);
      this.props.updatedAt = new Date();
    }
  }

  addPricingAuditItem(item: PricingAuditItem): void {
    this.props.pricingAudit.push({ ...item });
    this.props.updatedAt = new Date();
  }

  updateDisplayScore(score: number): void {
    if (score < 0 || score > 100) {
      throw new Error(`Display score must be 0-100, got: ${score}`);
    }
    this.props.displayScore = score;
    this.props.updatedAt = new Date();
  }

  updateNotes(notes: string): void {
    this.props.notes = notes;
    this.props.updatedAt = new Date();
  }

  /** Price discrepancies: items where actual != listed price */
  priceDiscrepancies(): PricingAuditItem[] {
    return this.props.pricingAudit.filter((p) => p.listedPrice !== p.actualPrice);
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
      shelfPhotos: this.props.shelfPhotos.map((p) => ({ ...p, timestamp: p.timestamp instanceof Date ? p.timestamp.toISOString() : p.timestamp })),
      planogramCompliance: this.props.planogramCompliance,
      shelfShareByBrand: this.props.shelfShareByBrand.map((s) => ({ ...s })),
      outOfStockSkus: [...this.props.outOfStockSkus],
      pricingAudit: this.props.pricingAudit.map((p) => ({ ...p })),
      displayScore: this.props.displayScore,
      notes: this.props.notes,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
      version: this.props.version,
    };
  }
}
