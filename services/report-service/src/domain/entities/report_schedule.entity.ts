export type ScheduleFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CRON';
export type ScheduleStatus = 'ACTIVE' | 'INACTIVE' | 'PAUSED';

export interface ReportScheduleProps {
  id: string;
  tenantId: string;
  reportName: string;
  cronExpression: string;
  frequency: ScheduleFrequency;
  status: ScheduleStatus;
  nextRunAt?: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export class ReportScheduleDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReportScheduleDomainError';
  }
}

export class ReportScheduleAggregate {
  private props: ReportScheduleProps;

  constructor(props: ReportScheduleProps) {
    this.validate(props);
    this.props = { ...props };
  }

  private validate(props: ReportScheduleProps): void {
    if (!props.id || props.id.trim().length === 0) {
      throw new ReportScheduleDomainError('ReportSchedule ID is required.');
    }
    if (!props.tenantId || props.tenantId.trim().length === 0) {
      throw new ReportScheduleDomainError('ReportSchedule tenantId is required.');
    }
    if (!props.reportName || props.reportName.trim().length === 0) {
      throw new ReportScheduleDomainError('ReportSchedule reportName is required.');
    }
    if (!props.cronExpression || props.cronExpression.trim().length === 0) {
      throw new ReportScheduleDomainError('ReportSchedule cronExpression is required.');
    }

    const validFrequencies: ScheduleFrequency[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'CRON'];
    if (!props.frequency || !validFrequencies.includes(props.frequency)) {
      throw new ReportScheduleDomainError(`Invalid ReportSchedule frequency: ${props.frequency}`);
    }

    const validStatuses: ScheduleStatus[] = ['ACTIVE', 'INACTIVE', 'PAUSED'];
    if (!props.status || !validStatuses.includes(props.status)) {
      throw new ReportScheduleDomainError(`Invalid ReportSchedule status: ${props.status}`);
    }

    if (props.version < 1) {
      throw new ReportScheduleDomainError('ReportSchedule version must be >= 1.');
    }
  }

  public static create(params: {
    id: string;
    tenantId: string;
    reportName: string;
    cronExpression: string;
    frequency?: ScheduleFrequency;
    status?: ScheduleStatus;
    nextRunAt?: Date;
  }): ReportScheduleAggregate {
    const now = new Date();
    return new ReportScheduleAggregate({
      id: params.id,
      tenantId: params.tenantId,
      reportName: params.reportName,
      cronExpression: params.cronExpression,
      frequency: params.frequency ?? 'DAILY',
      status: params.status ?? 'ACTIVE',
      nextRunAt: params.nextRunAt ?? new Date(Date.now() + 86400000),
      version: 1,
      createdAt: now,
      updatedAt: now
    });
  }

  public pause(expectedVersion: number): void {
    this.assertVersion(expectedVersion);
    if (this.props.status !== 'ACTIVE') {
      throw new ReportScheduleDomainError(`Cannot pause ReportSchedule in status ${this.props.status}. Must be ACTIVE.`);
    }
    this.props.status = 'PAUSED';
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  public resume(expectedVersion: number): void {
    this.assertVersion(expectedVersion);
    if (this.props.status !== 'PAUSED' && this.props.status !== 'INACTIVE') {
      throw new ReportScheduleDomainError(`Cannot resume ReportSchedule in status ${this.props.status}.`);
    }
    this.props.status = 'ACTIVE';
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  public deactivate(expectedVersion: number): void {
    this.assertVersion(expectedVersion);
    this.props.status = 'INACTIVE';
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  public updateSchedule(cronExpression: string, frequency: ScheduleFrequency, expectedVersion: number): void {
    this.assertVersion(expectedVersion);
    if (!cronExpression || cronExpression.trim().length === 0) {
      throw new ReportScheduleDomainError('ReportSchedule cronExpression cannot be empty.');
    }
    this.props.cronExpression = cronExpression.trim();
    this.props.frequency = frequency;
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  private assertVersion(expectedVersion: number): void {
    if (this.props.version !== expectedVersion) {
      throw new ReportScheduleDomainError(`Optimistic locking failure: expected version ${expectedVersion}, found ${this.props.version}`);
    }
  }

  public get id(): string { return this.props.id; }
  public get tenantId(): string { return this.props.tenantId; }
  public get reportName(): string { return this.props.reportName; }
  public get cronExpression(): string { return this.props.cronExpression; }
  public get frequency(): ScheduleFrequency { return this.props.frequency; }
  public get status(): ScheduleStatus { return this.props.status; }
  public get nextRunAt(): Date | null | undefined { return this.props.nextRunAt; }
  public get version(): number { return this.props.version; }
  public get createdAt(): Date { return this.props.createdAt; }
  public get updatedAt(): Date { return this.props.updatedAt; }
}
