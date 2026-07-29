export type RecommendationModelType = 'COLLABORATIVE_FILTERING' | 'CONTENT_BASED' | 'RULE_BASED' | 'HYBRID';
export type RecommendationModelStatus = 'DRAFT' | 'TRAINING' | 'ACTIVE' | 'RETIRED';

export interface RecommendationModelProps {
  id: string;
  tenantId: string;
  modelName: string;
  modelType: RecommendationModelType;
  precisionAtK?: number;
  recallAtK?: number;
  status: RecommendationModelStatus;
  hyperparameters: Record<string, any>;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export class RecommendationModelDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecommendationModelDomainError';
  }
}

export class RecommendationModelAggregate {
  private props: RecommendationModelProps;

  constructor(props: RecommendationModelProps) {
    this.validate(props);
    this.props = { ...props };
  }

  private validate(props: RecommendationModelProps): void {
    if (!props.id || props.id.trim().length === 0) {
      throw new RecommendationModelDomainError('RecommendationModel ID is required.');
    }
    if (!props.tenantId || props.tenantId.trim().length === 0) {
      throw new RecommendationModelDomainError('RecommendationModel tenantId is required.');
    }
    if (!props.modelName || props.modelName.trim().length === 0) {
      throw new RecommendationModelDomainError('RecommendationModel modelName is required.');
    }

    const validTypes: RecommendationModelType[] = ['COLLABORATIVE_FILTERING', 'CONTENT_BASED', 'RULE_BASED', 'HYBRID'];
    if (!props.modelType || !validTypes.includes(props.modelType)) {
      throw new RecommendationModelDomainError(`Invalid RecommendationModel modelType: ${props.modelType}`);
    }

    const validStatuses: RecommendationModelStatus[] = ['DRAFT', 'TRAINING', 'ACTIVE', 'RETIRED'];
    if (!props.status || !validStatuses.includes(props.status)) {
      throw new RecommendationModelDomainError(`Invalid RecommendationModel status: ${props.status}`);
    }

    if (props.precisionAtK !== undefined && (props.precisionAtK < 0.0 || props.precisionAtK > 1.0)) {
      throw new RecommendationModelDomainError('RecommendationModel precisionAtK must be between 0.0 and 1.0.');
    }

    if (props.recallAtK !== undefined && (props.recallAtK < 0.0 || props.recallAtK > 1.0)) {
      throw new RecommendationModelDomainError('RecommendationModel recallAtK must be between 0.0 and 1.0.');
    }

    if (props.version < 1) {
      throw new RecommendationModelDomainError('RecommendationModel version must be >= 1.');
    }
  }

  public static create(params: {
    id: string;
    tenantId: string;
    modelName: string;
    modelType?: RecommendationModelType;
    hyperparameters?: Record<string, any>;
  }): RecommendationModelAggregate {
    const now = new Date();
    return new RecommendationModelAggregate({
      id: params.id,
      tenantId: params.tenantId,
      modelName: params.modelName.trim(),
      modelType: params.modelType ?? 'COLLABORATIVE_FILTERING',
      status: 'DRAFT',
      hyperparameters: params.hyperparameters ?? {},
      version: 1,
      createdAt: now,
      updatedAt: now
    });
  }

  public startTraining(expectedVersion: number): void {
    this.assertVersion(expectedVersion);
    if (this.props.status !== 'DRAFT') {
      throw new RecommendationModelDomainError(`Cannot start training RecommendationModel from status '${this.props.status}'. Must be DRAFT.`);
    }
    this.props.status = 'TRAINING';
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  public activate(expectedVersion: number, precisionAtK?: number, recallAtK?: number): void {
    this.assertVersion(expectedVersion);
    if (this.props.status !== 'TRAINING' && this.props.status !== 'DRAFT') {
      throw new RecommendationModelDomainError(`Cannot activate RecommendationModel from status '${this.props.status}'. Must be TRAINING or DRAFT.`);
    }
    if (precisionAtK !== undefined) {
      if (precisionAtK < 0.0 || precisionAtK > 1.0) throw new RecommendationModelDomainError('precisionAtK must be between 0.0 and 1.0.');
      this.props.precisionAtK = precisionAtK;
    }
    if (recallAtK !== undefined) {
      if (recallAtK < 0.0 || recallAtK > 1.0) throw new RecommendationModelDomainError('recallAtK must be between 0.0 and 1.0.');
      this.props.recallAtK = recallAtK;
    }
    this.props.status = 'ACTIVE';
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  public approve(expectedVersion: number): void {
    this.assertVersion(expectedVersion);
    if (this.props.status === 'RETIRED') {
      throw new RecommendationModelDomainError('Cannot approve a RETIRED RecommendationModel.');
    }
    this.props.status = 'ACTIVE';
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  public retire(expectedVersion: number): void {
    this.assertVersion(expectedVersion);
    if (this.props.status === 'RETIRED') {
      throw new RecommendationModelDomainError('RecommendationModel is already RETIRED.');
    }
    this.props.status = 'RETIRED';
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  private assertVersion(expectedVersion: number): void {
    if (this.props.version !== expectedVersion) {
      throw new RecommendationModelDomainError(`Optimistic locking failure: expected version ${expectedVersion}, found ${this.props.version}`);
    }
  }

  public get id(): string { return this.props.id; }
  public get tenantId(): string { return this.props.tenantId; }
  public get modelName(): string { return this.props.modelName; }
  public get modelType(): RecommendationModelType { return this.props.modelType; }
  public get precisionAtK(): number | undefined { return this.props.precisionAtK; }
  public get recallAtK(): number | undefined { return this.props.recallAtK; }
  public get status(): RecommendationModelStatus { return this.props.status; }
  public get hyperparameters(): Record<string, any> { return { ...this.props.hyperparameters }; }
  public get version(): number { return this.props.version; }
  public get createdAt(): Date { return this.props.createdAt; }
  public get updatedAt(): Date { return this.props.updatedAt; }
}
