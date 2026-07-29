export type ConfigDataType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON';
export type ConfigStatus = 'ACTIVE' | 'INACTIVE' | 'DEPRECATED';

export interface ConfigEntryProps {
  id: string;
  tenantId: string;
  configKey: string;
  configValue: string;
  dataType: ConfigDataType;
  status: ConfigStatus;
  isEncrypted: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export class ConfigEntryDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigEntryDomainError';
  }
}

export class ConfigEntryAggregate {
  private props: ConfigEntryProps;

  constructor(props: ConfigEntryProps) {
    this.validate(props);
    this.props = { ...props };
  }

  private validate(props: ConfigEntryProps): void {
    if (!props.id || props.id.trim().length === 0) {
      throw new ConfigEntryDomainError('ConfigEntry ID is required.');
    }
    if (!props.tenantId || props.tenantId.trim().length === 0) {
      throw new ConfigEntryDomainError('ConfigEntry tenantId is required.');
    }
    if (!props.configKey || props.configKey.trim().length === 0) {
      throw new ConfigEntryDomainError('ConfigEntry configKey is required.');
    }
    if (props.configValue === undefined || props.configValue === null) {
      throw new ConfigEntryDomainError('ConfigEntry configValue is required.');
    }

    const validDataTypes: ConfigDataType[] = ['STRING', 'NUMBER', 'BOOLEAN', 'JSON'];
    if (!props.dataType || !validDataTypes.includes(props.dataType)) {
      throw new ConfigEntryDomainError(`Invalid ConfigEntry dataType: ${props.dataType}`);
    }

    const validStatuses: ConfigStatus[] = ['ACTIVE', 'INACTIVE', 'DEPRECATED'];
    if (!props.status || !validStatuses.includes(props.status)) {
      throw new ConfigEntryDomainError(`Invalid ConfigEntry status: ${props.status}`);
    }

    if (props.version < 1) {
      throw new ConfigEntryDomainError('ConfigEntry version must be >= 1.');
    }

    this.validateValueType(props.configValue, props.dataType);
  }

  private validateValueType(value: string, dataType: ConfigDataType): void {
    if (dataType === 'NUMBER') {
      const num = Number(value);
      if (isNaN(num)) {
        throw new ConfigEntryDomainError(`ConfigEntry value '${value}' is not a valid NUMBER.`);
      }
    } else if (dataType === 'BOOLEAN') {
      const lower = value.toLowerCase().trim();
      if (lower !== 'true' && lower !== 'false') {
        throw new ConfigEntryDomainError(`ConfigEntry value '${value}' is not a valid BOOLEAN ('true' or 'false').`);
      }
    } else if (dataType === 'JSON') {
      try {
        JSON.parse(value);
      } catch {
        throw new ConfigEntryDomainError(`ConfigEntry value is not valid JSON.`);
      }
    }
  }

  public static create(params: {
    id: string;
    tenantId: string;
    configKey: string;
    configValue: string;
    dataType?: ConfigDataType;
    status?: ConfigStatus;
    isEncrypted?: boolean;
  }): ConfigEntryAggregate {
    const now = new Date();
    return new ConfigEntryAggregate({
      id: params.id,
      tenantId: params.tenantId,
      configKey: params.configKey.trim(),
      configValue: params.configValue,
      dataType: params.dataType ?? 'STRING',
      status: params.status ?? 'ACTIVE',
      isEncrypted: params.isEncrypted ?? false,
      version: 1,
      createdAt: now,
      updatedAt: now
    });
  }

  public updateValue(newValue: string, expectedVersion: number): void {
    this.assertVersion(expectedVersion);
    if (newValue === undefined || newValue === null) {
      throw new ConfigEntryDomainError('ConfigEntry configValue cannot be null/undefined.');
    }
    this.validateValueType(newValue, this.props.dataType);
    this.props.configValue = newValue;
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  public activate(expectedVersion: number): void {
    this.assertVersion(expectedVersion);
    if (this.props.status === 'DEPRECATED') {
      throw new ConfigEntryDomainError(`Cannot activate a DEPRECATED ConfigEntry.`);
    }
    this.props.status = 'ACTIVE';
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  public deactivate(expectedVersion: number): void {
    this.assertVersion(expectedVersion);
    if (this.props.status === 'DEPRECATED') {
      throw new ConfigEntryDomainError(`Cannot deactivate a DEPRECATED ConfigEntry.`);
    }
    this.props.status = 'INACTIVE';
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  public deprecate(expectedVersion: number): void {
    this.assertVersion(expectedVersion);
    this.props.status = 'DEPRECATED';
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  private assertVersion(expectedVersion: number): void {
    if (this.props.version !== expectedVersion) {
      throw new ConfigEntryDomainError(`Optimistic locking failure: expected version ${expectedVersion}, found ${this.props.version}`);
    }
  }

  public get id(): string { return this.props.id; }
  public get tenantId(): string { return this.props.tenantId; }
  public get configKey(): string { return this.props.configKey; }
  public get configValue(): string { return this.props.configValue; }
  public get dataType(): ConfigDataType { return this.props.dataType; }
  public get status(): ConfigStatus { return this.props.status; }
  public get isEncrypted(): boolean { return this.props.isEncrypted; }
  public get version(): number { return this.props.version; }
  public get createdAt(): Date { return this.props.createdAt; }
  public get updatedAt(): Date { return this.props.updatedAt; }
}
