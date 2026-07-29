export type ForecastAlgorithm = 'ARIMA' | 'PROPHET' | 'EXPONENTIAL_SMOOTHING' | 'NEURAL_NETWORK';
export type ForecastModelStatus = 'DRAFT' | 'TRAINING' | 'ACTIVE' | 'RETIRED';

export interface ForecastModelProps {
  id: string;
  tenantId: string;
  modelName: string;
  algorithm: ForecastAlgorithm;
  status: ForecastModelStatus;
  accuracyMape?: number;
  accuracyRmse?: number;
  hyperparameters: Record<string, any>;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export class ForecastModelDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForecastModelDomainError';
  }
}

export class ForecastModelAggregate {
  private props: ForecastModelProps;

  constructor(props: ForecastModelProps) {
    this.validate(props);
    this.props = { ...props };
  }

  private validate(props: ForecastModelProps): void {
    if (!props.id || props.id.trim().length === 0) {
      throw new ForecastModelDomainError('ForecastModel ID is required.');
    }
    if (!props.tenantId || props.tenantId.trim().length === 0) {
      throw new ForecastModelDomainError('ForecastModel tenantId is required.');
    }
    if (!props.modelName || props.modelName.trim().length === 0) {
      throw new ForecastModelDomainError('ForecastModel modelName is required.');
    }

    const validAlgorithms: ForecastAlgorithm[] = ['ARIMA', 'PROPHET', 'EXPONENTIAL_SMOOTHING', 'NEURAL_NETWORK'];
    if (!props.algorithm || !validAlgorithms.includes(props.algorithm)) {
      throw new ForecastModelDomainError(`Invalid ForecastModel algorithm: ${props.algorithm}`);
    }

    const validStatuses: ForecastModelStatus[] = ['DRAFT', 'TRAINING', 'ACTIVE', 'RETIRED'];
    if (!props.status || !validStatuses.includes(props.status)) {
      throw new ForecastModelDomainError(`Invalid ForecastModel status: ${props.status}`);
    }

    if (props.version < 1) {
      throw new ForecastModelDomainError('ForecastModel version must be >= 1.');
    }
  }

  public static create(params: {
    id: string;
    tenantId: string;
    modelName: string;
    algorithm?: ForecastAlgorithm;
    hyperparameters?: Record<string, any>;
  }): ForecastModelAggregate {
    const now = new Date();
    return new ForecastModelAggregate({
      id: params.id,
      tenantId: params.tenantId,
      modelName: params.modelName.trim(),
      algorithm: params.algorithm ?? 'ARIMA',
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
      throw new ForecastModelDomainError(`Cannot start training from status '${this.props.status}'. Must be DRAFT.`);
    }
    this.props.status = 'TRAINING';
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  public activate(accuracyMape: number, accuracyRmse: number, expectedVersion: number): void {
    this.assertVersion(expectedVersion);
    if (this.props.status !== 'TRAINING' && this.props.status !== 'DRAFT') {
      throw new ForecastModelDomainError(`Cannot activate ForecastModel from status '${this.props.status}'.`);
    }
    if (accuracyMape < 0 || accuracyRmse < 0) {
      throw new ForecastModelDomainError('Accuracy metrics (MAPE/RMSE) must be non-negative numbers.');
    }

    this.props.accuracyMape = accuracyMape;
    this.props.accuracyRmse = accuracyRmse;
    this.props.status = 'ACTIVE';
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  public approve(expectedVersion: number): void {
    this.assertVersion(expectedVersion);
    if (this.props.status === 'RETIRED') {
      throw new ForecastModelDomainError('Cannot approve a RETIRED ForecastModel.');
    }
    this.props.status = 'ACTIVE';
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  public retire(expectedVersion: number): void {
    this.assertVersion(expectedVersion);
    if (this.props.status === 'RETIRED') {
      throw new ForecastModelDomainError('ForecastModel is already RETIRED.');
    }
    this.props.status = 'RETIRED';
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  private assertVersion(expectedVersion: number): void {
    if (this.props.version !== expectedVersion) {
      throw new ForecastModelDomainError(`Optimistic locking failure: expected version ${expectedVersion}, found ${this.props.version}`);
    }
  }

  public get id(): string { return this.props.id; }
  public get tenantId(): string { return this.props.tenantId; }
  public get modelName(): string { return this.props.modelName; }
  public get algorithm(): ForecastAlgorithm { return this.props.algorithm; }
  public get status(): ForecastModelStatus { return this.props.status; }
  public get accuracyMape(): number | undefined { return this.props.accuracyMape; }
  public get accuracyRmse(): number | undefined { return this.props.accuracyRmse; }
  public get hyperparameters(): Record<string, any> { return { ...this.props.hyperparameters }; }
  public get version(): number { return this.props.version; }
  public get createdAt(): Date { return this.props.createdAt; }
  public get updatedAt(): Date { return this.props.updatedAt; }
}
