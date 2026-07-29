export type ReportType = 'SALES' | 'INVENTORY' | 'FINANCIAL' | 'AUDIT' | 'CUSTOM';
export type ReportStatus = 'DRAFT' | 'GENERATING' | 'COMPLETED' | 'FAILED';

export interface ReportProps {
  id: string;
  tenantId: string;
  name: string;
  type: ReportType;
  parameters: Record<string, any>;
  status: ReportStatus;
  downloadUrl?: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export class ReportDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReportDomainError';
  }
}

export class ReportAggregate {
  private props: ReportProps;

  constructor(props: ReportProps) {
    this.validate(props);
    this.props = { ...props };
  }

  private validate(props: ReportProps): void {
    if (!props.id || props.id.trim().length === 0) {
      throw new ReportDomainError('Report ID is required.');
    }
    if (!props.tenantId || props.tenantId.trim().length === 0) {
      throw new ReportDomainError('Report tenantId is required.');
    }
    if (!props.name || props.name.trim().length === 0) {
      throw new ReportDomainError('Report name is required.');
    }

    const validTypes: ReportType[] = ['SALES', 'INVENTORY', 'FINANCIAL', 'AUDIT', 'CUSTOM'];
    if (!props.type || !validTypes.includes(props.type)) {
      throw new ReportDomainError(`Invalid Report type: ${props.type}`);
    }

    const validStatuses: ReportStatus[] = ['DRAFT', 'GENERATING', 'COMPLETED', 'FAILED'];
    if (!props.status || !validStatuses.includes(props.status)) {
      throw new ReportDomainError(`Invalid Report status: ${props.status}`);
    }

    if (props.version < 1) {
      throw new ReportDomainError('Report version must be >= 1.');
    }
  }

  public static create(params: {
    id: string;
    tenantId: string;
    name: string;
    type: ReportType;
    parameters?: Record<string, any>;
    status?: ReportStatus;
    downloadUrl?: string;
  }): ReportAggregate {
    const now = new Date();
    return new ReportAggregate({
      id: params.id,
      tenantId: params.tenantId,
      name: params.name,
      type: params.type,
      parameters: params.parameters ?? {},
      status: params.status ?? 'DRAFT',
      downloadUrl: params.downloadUrl ?? null,
      version: 1,
      createdAt: now,
      updatedAt: now
    });
  }

  public startGenerating(expectedVersion: number): void {
    this.assertVersion(expectedVersion);
    if (this.props.status !== 'DRAFT') {
      throw new ReportDomainError(`Cannot transition from ${this.props.status} to GENERATING.`);
    }
    this.props.status = 'GENERATING';
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  public markCompleted(downloadUrl: string, expectedVersion: number): void {
    this.assertVersion(expectedVersion);
    if (this.props.status !== 'GENERATING' && this.props.status !== 'DRAFT') {
      throw new ReportDomainError(`Cannot complete Report in status ${this.props.status}.`);
    }
    if (!downloadUrl || downloadUrl.trim().length === 0) {
      throw new ReportDomainError('Report downloadUrl is required when marking COMPLETED.');
    }
    this.props.downloadUrl = downloadUrl.trim();
    this.props.status = 'COMPLETED';
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  public markFailed(expectedVersion: number): void {
    this.assertVersion(expectedVersion);
    this.props.status = 'FAILED';
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  public approve(): void {
    if (this.props.status === 'DRAFT') {
      this.props.status = 'GENERATING';
      this.props.version += 1;
      this.props.updatedAt = new Date();
    }
  }

  public updateName(name: string, expectedVersion: number): void {
    this.assertVersion(expectedVersion);
    if (!name || name.trim().length === 0) {
      throw new ReportDomainError('Report name cannot be empty.');
    }
    this.props.name = name.trim();
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  private assertVersion(expectedVersion: number): void {
    if (this.props.version !== expectedVersion) {
      throw new ReportDomainError(`Optimistic locking failure: expected version ${expectedVersion}, found ${this.props.version}`);
    }
  }

  public get id(): string { return this.props.id; }
  public get tenantId(): string { return this.props.tenantId; }
  public get name(): string { return this.props.name; }
  public get type(): ReportType { return this.props.type; }
  public get parameters(): Record<string, any> { return { ...this.props.parameters }; }
  public get status(): ReportStatus { return this.props.status; }
  public get downloadUrl(): string | null | undefined { return this.props.downloadUrl; }
  public get version(): number { return this.props.version; }
  public get createdAt(): Date { return this.props.createdAt; }
  public get updatedAt(): Date { return this.props.updatedAt; }
}
