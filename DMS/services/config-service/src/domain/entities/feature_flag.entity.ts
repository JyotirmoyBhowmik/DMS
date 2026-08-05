export type FlagStrategy = 'BOOLEAN' | 'PERCENTAGE' | 'GRADUAL';
export type FlagStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export interface TargetRule {
  attribute: string;
  operator: 'eq' | 'neq' | 'in' | 'nin';
  values: string[];
}

export interface FeatureFlagProps {
  id: string;
  tenantId: string;
  flagKey: string;
  description: string;
  strategy: FlagStrategy;
  enabled: boolean;
  rolloutPercentage: number;
  targetRules: TargetRule[];
  status: FlagStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export class FeatureFlagDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FeatureFlagDomainError';
  }
}

export class FeatureFlagAggregate {
  private props: FeatureFlagProps;

  constructor(props: FeatureFlagProps) {
    this.validate(props);
    this.props = { ...props };
  }

  private validate(props: FeatureFlagProps): void {
    if (!props.id || props.id.trim().length === 0) {
      throw new FeatureFlagDomainError('FeatureFlag ID is required.');
    }
    if (!props.tenantId || props.tenantId.trim().length === 0) {
      throw new FeatureFlagDomainError('FeatureFlag tenantId is required.');
    }
    if (!props.flagKey || props.flagKey.trim().length === 0) {
      throw new FeatureFlagDomainError('FeatureFlag flagKey is required.');
    }

    const validStrategies: FlagStrategy[] = ['BOOLEAN', 'PERCENTAGE', 'GRADUAL'];
    if (!props.strategy || !validStrategies.includes(props.strategy)) {
      throw new FeatureFlagDomainError(`Invalid FeatureFlag strategy: ${props.strategy}`);
    }

    const validStatuses: FlagStatus[] = ['ACTIVE', 'INACTIVE', 'ARCHIVED'];
    if (!props.status || !validStatuses.includes(props.status)) {
      throw new FeatureFlagDomainError(`Invalid FeatureFlag status: ${props.status}`);
    }

    if (props.rolloutPercentage < 0 || props.rolloutPercentage > 100) {
      throw new FeatureFlagDomainError('FeatureFlag rolloutPercentage must be between 0 and 100.');
    }

    if (props.version < 1) {
      throw new FeatureFlagDomainError('FeatureFlag version must be >= 1.');
    }
  }

  public static create(params: {
    id: string;
    tenantId: string;
    flagKey: string;
    description?: string;
    strategy?: FlagStrategy;
    enabled?: boolean;
    rolloutPercentage?: number;
    targetRules?: TargetRule[];
    status?: FlagStatus;
  }): FeatureFlagAggregate {
    const now = new Date();
    return new FeatureFlagAggregate({
      id: params.id,
      tenantId: params.tenantId,
      flagKey: params.flagKey.trim(),
      description: params.description ?? '',
      strategy: params.strategy ?? 'BOOLEAN',
      enabled: params.enabled ?? false,
      rolloutPercentage: params.rolloutPercentage ?? 100,
      targetRules: params.targetRules ?? [],
      status: params.status ?? 'ACTIVE',
      version: 1,
      createdAt: now,
      updatedAt: now
    });
  }

  public toggle(enabled: boolean, expectedVersion: number): void {
    this.assertVersion(expectedVersion);
    if (this.props.status === 'ARCHIVED') {
      throw new FeatureFlagDomainError('Cannot toggle an ARCHIVED FeatureFlag.');
    }
    this.props.enabled = enabled;
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  public updateStrategy(
    strategy: FlagStrategy,
    rolloutPercentage: number,
    targetRules: TargetRule[],
    expectedVersion: number
  ): void {
    this.assertVersion(expectedVersion);
    if (this.props.status === 'ARCHIVED') {
      throw new FeatureFlagDomainError('Cannot update strategy of an ARCHIVED FeatureFlag.');
    }
    if (rolloutPercentage < 0 || rolloutPercentage > 100) {
      throw new FeatureFlagDomainError('rolloutPercentage must be between 0 and 100.');
    }
    this.props.strategy = strategy;
    this.props.rolloutPercentage = rolloutPercentage;
    this.props.targetRules = [...targetRules];
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  public activate(expectedVersion: number): void {
    this.assertVersion(expectedVersion);
    if (this.props.status === 'ARCHIVED') {
      throw new FeatureFlagDomainError('Cannot activate an ARCHIVED FeatureFlag.');
    }
    this.props.status = 'ACTIVE';
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  public approve(expectedVersion: number): void {
    this.assertVersion(expectedVersion);
    if (this.props.status === 'ARCHIVED') {
      throw new FeatureFlagDomainError('Cannot approve an ARCHIVED FeatureFlag.');
    }
    this.props.status = 'ACTIVE';
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  public deactivate(expectedVersion: number): void {
    this.assertVersion(expectedVersion);
    if (this.props.status === 'ARCHIVED') {
      throw new FeatureFlagDomainError('Cannot deactivate an ARCHIVED FeatureFlag.');
    }
    this.props.status = 'INACTIVE';
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  public archive(expectedVersion: number): void {
    this.assertVersion(expectedVersion);
    this.props.status = 'ARCHIVED';
    this.props.enabled = false;
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  private assertVersion(expectedVersion: number): void {
    if (this.props.version !== expectedVersion) {
      throw new FeatureFlagDomainError(`Optimistic locking failure: expected version ${expectedVersion}, found ${this.props.version}`);
    }
  }

  public evaluate(context?: { userId?: string; attributes?: Record<string, any> }): boolean {
    if (this.props.status !== 'ACTIVE' || !this.props.enabled) {
      return false;
    }

    if (this.props.strategy === 'BOOLEAN') {
      return this.props.enabled;
    }

    if (this.props.strategy === 'PERCENTAGE' || this.props.strategy === 'GRADUAL') {
      if (this.props.targetRules.length > 0 && context?.attributes) {
        for (const rule of this.props.targetRules) {
          const attrVal = context.attributes[rule.attribute];
          if (attrVal === undefined) return false;

          if (rule.operator === 'eq' && attrVal !== rule.values[0]) return false;
          if (rule.operator === 'neq' && attrVal === rule.values[0]) return false;
          if (rule.operator === 'in' && !rule.values.includes(String(attrVal))) return false;
          if (rule.operator === 'nin' && rule.values.includes(String(attrVal))) return false;
        }
      }

      if (this.props.rolloutPercentage === 100) return true;
      if (this.props.rolloutPercentage === 0) return false;

      const userKey = context?.userId ?? 'anonymous';
      let hash = 0;
      for (let i = 0; i < userKey.length; i++) {
        hash = (hash * 31 + userKey.charCodeAt(i)) % 100;
      }
      return Math.abs(hash) < this.props.rolloutPercentage;
    }

    return false;
  }

  public get id(): string { return this.props.id; }
  public get tenantId(): string { return this.props.tenantId; }
  public get flagKey(): string { return this.props.flagKey; }
  public get description(): string { return this.props.description; }
  public get strategy(): FlagStrategy { return this.props.strategy; }
  public get enabled(): boolean { return this.props.enabled; }
  public get rolloutPercentage(): number { return this.props.rolloutPercentage; }
  public get targetRules(): TargetRule[] { return [...this.props.targetRules]; }
  public get status(): FlagStatus { return this.props.status; }
  public get version(): number { return this.props.version; }
  public get createdAt(): Date { return this.props.createdAt; }
  public get updatedAt(): Date { return this.props.updatedAt; }
}
