import { Money } from '../value-objects/money';

export interface CompetitorCaptureProps {
  id: string;
  tenantId: string;
  outletId: string;
  brand: string;
  skuId: string;
  observedPrice: Money;
  promotionDetails?: string;
  photoUrl?: string;
  version: number;
}

export class CompetitorCapture {
  private props: CompetitorCaptureProps;

  private constructor(props: CompetitorCaptureProps) {
    this.props = { ...props };
  }

  static create(input: {
    id: string;
    tenantId: string;
    outletId: string;
    brand: string;
    skuId: string;
    observedPrice: Money;
    promotionDetails?: string;
    photoUrl?: string;
  }): CompetitorCapture {
    return new CompetitorCapture({
      ...input,
      version: 0,
    });
  }

  static reconstitute(props: CompetitorCaptureProps): CompetitorCapture {
    return new CompetitorCapture(props);
  }

  get id(): string { return this.props.id; }
  get tenantId(): string { return this.props.tenantId; }
  get outletId(): string { return this.props.outletId; }
  get brand(): string { return this.props.brand; }
  get skuId(): string { return this.props.skuId; }
  get observedPrice(): Money { return this.props.observedPrice; }
  get promotionDetails(): string | undefined { return this.props.promotionDetails; }
  get photoUrl(): string | undefined { return this.props.photoUrl; }
  get version(): number { return this.props.version; }

  incrementVersion(): void {
    this.props.version += 1;
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.props.id,
      tenantId: this.props.tenantId,
      outletId: this.props.outletId,
      brand: this.props.brand,
      skuId: this.props.skuId,
      observedPrice: this.props.observedPrice.toJSON(),
      promotionDetails: this.props.promotionDetails,
      photoUrl: this.props.photoUrl,
      version: this.props.version,
    };
  }
}
