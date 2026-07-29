export type DemandSignalType = 'HISTORICAL_SALES' | 'PROMOTION' | 'SEASONALITY' | 'MARKET_TREND';
export type DemandSignalStatus = 'PENDING' | 'PROCESSED' | 'ARCHIVED';

export interface DemandSignalProps {
  id: string;
  tenantId: string;
  signalName: string;
  signalType: DemandSignalType;
  signalValue: number;
  confidenceScore: number;
  status: DemandSignalStatus;
  sourceChannel: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export class DemandSignalDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DemandSignalDomainError';
  }
}

export class DemandSignalAggregate {
  private props: DemandSignalProps;

  constructor(props: DemandSignalProps) {
    this.validate(props);
    this.props = { ...props };
  }

  private validate(props: DemandSignalProps): void {
    if (!props.id || props.id.trim().length === 0) {
      throw new DemandSignalDomainError('DemandSignal ID is required.');
    }
    if (!props.tenantId || props.tenantId.trim().length === 0) {
      throw new DemandSignalDomainError('DemandSignal tenantId is required.');
    }
    if (!props.signalName || props.signalName.trim().length === 0) {
      throw new DemandSignalDomainError('DemandSignal signalName is required.');
    }

    const validTypes: DemandSignalType[] = ['HISTORICAL_SALES', 'PROMOTION', 'SEASONALITY', 'MARKET_TREND'];
    if (!props.signalType || !validTypes.includes(props.signalType)) {
      throw new DemandSignalDomainError(`Invalid DemandSignal signalType: ${props.signalType}`);
    }

    const validStatuses: DemandSignalStatus[] = ['PENDING', 'PROCESSED', 'ARCHIVED'];
    if (!props.status || !validStatuses.includes(props.status)) {
      throw new DemandSignalDomainError(`Invalid DemandSignal status: ${props.status}`);
    }

    if (props.confidenceScore < 0.0 || props.confidenceScore > 1.0) {
      throw new DemandSignalDomainError('DemandSignal confidenceScore must be between 0.0 and 1.0.');
    }

    if (props.version < 1) {
      throw new DemandSignalDomainError('DemandSignal version must be >= 1.');
    }
  }

  public static create(params: {
    id: string;
    tenantId: string;
    signalName: string;
    signalType?: DemandSignalType;
    signalValue?: number;
    confidenceScore?: number;
    sourceChannel?: string;
  }): DemandSignalAggregate {
    const now = new Date();
    return new DemandSignalAggregate({
      id: params.id,
      tenantId: params.tenantId,
      signalName: params.signalName.trim(),
      signalType: params.signalType ?? 'HISTORICAL_SALES',
      signalValue: params.signalValue ?? 0.0,
      confidenceScore: params.confidenceScore ?? 1.0,
      status: 'PENDING',
      sourceChannel: params.sourceChannel ?? 'SYSTEM',
      version: 1,
      createdAt: now,
      updatedAt: now
    });
  }

  public processSignal(expectedVersion: number): void {
    this.assertVersion(expectedVersion);
    if (this.props.status === 'ARCHIVED') {
      throw new DemandSignalDomainError('Cannot process an ARCHIVED DemandSignal.');
    }
    this.props.status = 'PROCESSED';
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  public approve(expectedVersion: number): void {
    this.assertVersion(expectedVersion);
    if (this.props.status === 'ARCHIVED') {
      throw new DemandSignalDomainError('Cannot approve an ARCHIVED DemandSignal.');
    }
    this.props.status = 'PROCESSED';
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  public updateValue(signalValue: number, confidenceScore: number, expectedVersion: number): void {
    this.assertVersion(expectedVersion);
    if (this.props.status === 'ARCHIVED') {
      throw new DemandSignalDomainError('Cannot update value of an ARCHIVED DemandSignal.');
    }
    if (confidenceScore < 0.0 || confidenceScore > 1.0) {
      throw new DemandSignalDomainError('confidenceScore must be between 0.0 and 1.0.');
    }
    this.props.signalValue = signalValue;
    this.props.confidenceScore = confidenceScore;
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  public archive(expectedVersion: number): void {
    this.assertVersion(expectedVersion);
    if (this.props.status === 'ARCHIVED') {
      throw new DemandSignalDomainError('DemandSignal is already ARCHIVED.');
    }
    this.props.status = 'ARCHIVED';
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  private assertVersion(expectedVersion: number): void {
    if (this.props.version !== expectedVersion) {
      throw new DemandSignalDomainError(`Optimistic locking failure: expected version ${expectedVersion}, found ${this.props.version}`);
    }
  }

  public get id(): string { return this.props.id; }
  public get tenantId(): string { return this.props.tenantId; }
  public get signalName(): string { return this.props.signalName; }
  public get signalType(): DemandSignalType { return this.props.signalType; }
  public get signalValue(): number { return this.props.signalValue; }
  public get confidenceScore(): number { return this.props.confidenceScore; }
  public get status(): DemandSignalStatus { return this.props.status; }
  public get sourceChannel(): string { return this.props.sourceChannel; }
  public get version(): number { return this.props.version; }
  public get createdAt(): Date { return this.props.createdAt; }
  public get updatedAt(): Date { return this.props.updatedAt; }
}
