export type RecommendationTargetType = 'OUTLET' | 'PRODUCT' | 'DISTRIBUTOR';
export type RecommendationType = 'CROSS_SELL' | 'UP_SELL' | 'INVENTORY_REPLENISHMENT' | 'PRICE_OPTIMIZATION';
export type RecommendationStatus = 'DRAFT' | 'ACTIVE' | 'APPLIED' | 'DISMISSED' | 'EXPIRED';

export interface RecommendationProps {
  id: string;
  tenantId: string;
  title: string;
  targetType: RecommendationTargetType;
  targetId: string;
  recommendationType: RecommendationType;
  score: number;
  status: RecommendationStatus;
  payload: Record<string, any>;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export class RecommendationDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecommendationDomainError';
  }
}

export class RecommendationAggregate {
  private props: RecommendationProps;

  constructor(props: RecommendationProps) {
    this.validate(props);
    this.props = { ...props };
  }

  private validate(props: RecommendationProps): void {
    if (!props.id || props.id.trim().length === 0) {
      throw new RecommendationDomainError('Recommendation ID is required.');
    }
    if (!props.tenantId || props.tenantId.trim().length === 0) {
      throw new RecommendationDomainError('Recommendation tenantId is required.');
    }
    if (!props.title || props.title.trim().length === 0) {
      throw new RecommendationDomainError('Recommendation title is required.');
    }
    if (!props.targetId || props.targetId.trim().length === 0) {
      throw new RecommendationDomainError('Recommendation targetId is required.');
    }

    const validTargetTypes: RecommendationTargetType[] = ['OUTLET', 'PRODUCT', 'DISTRIBUTOR'];
    if (!props.targetType || !validTargetTypes.includes(props.targetType)) {
      throw new RecommendationDomainError(`Invalid Recommendation targetType: ${props.targetType}`);
    }

    const validRecTypes: RecommendationType[] = ['CROSS_SELL', 'UP_SELL', 'INVENTORY_REPLENISHMENT', 'PRICE_OPTIMIZATION'];
    if (!props.recommendationType || !validRecTypes.includes(props.recommendationType)) {
      throw new RecommendationDomainError(`Invalid Recommendation recommendationType: ${props.recommendationType}`);
    }

    const validStatuses: RecommendationStatus[] = ['DRAFT', 'ACTIVE', 'APPLIED', 'DISMISSED', 'EXPIRED'];
    if (!props.status || !validStatuses.includes(props.status)) {
      throw new RecommendationDomainError(`Invalid Recommendation status: ${props.status}`);
    }

    if (props.score < 0.0 || props.score > 1.0) {
      throw new RecommendationDomainError('Recommendation score must be between 0.0 and 1.0.');
    }

    if (props.version < 1) {
      throw new RecommendationDomainError('Recommendation version must be >= 1.');
    }
  }

  public static create(params: {
    id: string;
    tenantId: string;
    title: string;
    targetType?: RecommendationTargetType;
    targetId: string;
    recommendationType?: RecommendationType;
    score?: number;
    payload?: Record<string, any>;
  }): RecommendationAggregate {
    const now = new Date();
    return new RecommendationAggregate({
      id: params.id,
      tenantId: params.tenantId,
      title: params.title.trim(),
      targetType: params.targetType ?? 'OUTLET',
      targetId: params.targetId,
      recommendationType: params.recommendationType ?? 'CROSS_SELL',
      score: params.score ?? 0.5000,
      status: 'DRAFT',
      payload: params.payload ?? {},
      version: 1,
      createdAt: now,
      updatedAt: now
    });
  }

  public activate(expectedVersion: number): void {
    this.assertVersion(expectedVersion);
    if (this.props.status === 'EXPIRED' || this.props.status === 'DISMISSED') {
      throw new RecommendationDomainError(`Cannot activate Recommendation from status '${this.props.status}'.`);
    }
    this.props.status = 'ACTIVE';
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  public approve(expectedVersion: number): void {
    this.assertVersion(expectedVersion);
    if (this.props.status === 'EXPIRED' || this.props.status === 'DISMISSED') {
      throw new RecommendationDomainError(`Cannot approve Recommendation from status '${this.props.status}'.`);
    }
    this.props.status = 'ACTIVE';
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  public apply(expectedVersion: number): void {
    this.assertVersion(expectedVersion);
    if (this.props.status !== 'ACTIVE' && this.props.status !== 'DRAFT') {
      throw new RecommendationDomainError(`Cannot apply Recommendation from status '${this.props.status}'. Must be ACTIVE or DRAFT.`);
    }
    this.props.status = 'APPLIED';
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  public dismiss(expectedVersion: number): void {
    this.assertVersion(expectedVersion);
    if (this.props.status === 'EXPIRED') {
      throw new RecommendationDomainError('Recommendation is already EXPIRED.');
    }
    this.props.status = 'DISMISSED';
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  public expire(expectedVersion: number): void {
    this.assertVersion(expectedVersion);
    if (this.props.status === 'EXPIRED') {
      throw new RecommendationDomainError('Recommendation is already EXPIRED.');
    }
    this.props.status = 'EXPIRED';
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  private assertVersion(expectedVersion: number): void {
    if (this.props.version !== expectedVersion) {
      throw new RecommendationDomainError(`Optimistic locking failure: expected version ${expectedVersion}, found ${this.props.version}`);
    }
  }

  public get id(): string { return this.props.id; }
  public get tenantId(): string { return this.props.tenantId; }
  public get title(): string { return this.props.title; }
  public get targetType(): RecommendationTargetType { return this.props.targetType; }
  public get targetId(): string { return this.props.targetId; }
  public get recommendationType(): RecommendationType { return this.props.recommendationType; }
  public get score(): number { return this.props.score; }
  public get status(): RecommendationStatus { return this.props.status; }
  public get payload(): Record<string, any> { return { ...this.props.payload }; }
  public get version(): number { return this.props.version; }
  public get createdAt(): Date { return this.props.createdAt; }
  public get updatedAt(): Date { return this.props.updatedAt; }
}
