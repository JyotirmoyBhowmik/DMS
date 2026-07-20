export type KPIAchievementStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export interface KPIAchievementProps {
  id: string;
  tenantId: string;
  agentId: string;
  kpiType: string;
  periodMonth: number; // 1-12
  periodYear: number;
  targetValue: number;
  achievedValue: number;
  status: KPIAchievementStatus;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export class KPIAchievement {
  private props: KPIAchievementProps;

  private constructor(props: KPIAchievementProps) {
    this.props = { ...props };
  }

  static create(input: {
    id: string;
    tenantId: string;
    agentId: string;
    kpiType: string;
    periodMonth: number;
    periodYear: number;
    targetValue: number;
    status?: KPIAchievementStatus;
  }): KPIAchievement {
    if (!input.id || input.id.trim().length === 0) throw new Error('ID cannot be empty');
    if (!input.tenantId || input.tenantId.trim().length === 0) throw new Error('tenantId cannot be empty');
    if (!input.agentId || input.agentId.trim().length === 0) throw new Error('agentId cannot be empty');
    if (!input.kpiType || input.kpiType.trim().length === 0) throw new Error('kpiType cannot be empty');

    if (input.periodMonth < 1 || input.periodMonth > 12) {
      throw new Error('periodMonth must be between 1 and 12');
    }
    if (input.periodYear < 2000 || input.periodYear > 2100) {
      throw new Error('periodYear must be a valid year between 2000 and 2100');
    }
    if (input.targetValue < 0) {
      throw new Error('Target value cannot be negative');
    }

    const now = new Date();
    return new KPIAchievement({
      id: input.id,
      tenantId: input.tenantId,
      agentId: input.agentId,
      kpiType: input.kpiType,
      periodMonth: input.periodMonth,
      periodYear: input.periodYear,
      targetValue: input.targetValue,
      achievedValue: 0,
      status: input.status ?? 'DRAFT',
      createdAt: now,
      updatedAt: now,
      version: 1,
    });
  }

  static fromPersistence(props: KPIAchievementProps): KPIAchievement {
    return new KPIAchievement(props);
  }

  get id(): string { return this.props.id; }
  get tenantId(): string { return this.props.tenantId; }
  get agentId(): string { return this.props.agentId; }
  get kpiType(): string { return this.props.kpiType; }
  get periodMonth(): number { return this.props.periodMonth; }
  get periodYear(): number { return this.props.periodYear; }
  get targetValue(): number { return this.props.targetValue; }
  get achievedValue(): number { return this.props.achievedValue; }
  get status(): KPIAchievementStatus { return this.props.status; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get version(): number { return this.props.version; }

  // State Transitions
  submit(): void {
    if (this.props.status !== 'DRAFT') {
      throw new Error(`Cannot submit kpi achievement from status '${this.props.status}'`);
    }
    this.props.status = 'SUBMITTED';
    this.props.updatedAt = new Date();
  }

  approve(): void {
    if (this.props.status !== 'SUBMITTED') {
      throw new Error(`Cannot approve kpi achievement from status '${this.props.status}'`);
    }
    this.props.status = 'APPROVED';
    this.props.updatedAt = new Date();
  }

  reject(): void {
    if (this.props.status !== 'SUBMITTED') {
      throw new Error(`Cannot reject kpi achievement from status '${this.props.status}'`);
    }
    this.props.status = 'REJECTED';
    this.props.updatedAt = new Date();
  }

  updateProgress(value: number): void {
    if (this.props.status !== 'DRAFT' && this.props.status !== 'SUBMITTED' && this.props.status !== 'APPROVED') {
      throw new Error('Can only update progress of active kpi achievements');
    }
    if (value < 0) {
      throw new Error('Progress increment value cannot be negative');
    }
    this.props.achievedValue = value;
    this.props.updatedAt = new Date();
  }

  updateTargetValue(value: number): void {
    if (this.props.status !== 'DRAFT') {
      throw new Error('Can only modify target value in DRAFT status');
    }
    if (value < 0) {
      throw new Error('Target value cannot be negative');
    }
    this.props.targetValue = value;
    this.props.updatedAt = new Date();
  }

  incrementVersion(): void {
    this.props.version += 1;
  }

  get progressPercentage(): number {
    if (this.props.targetValue <= 0) return 100;
    return (this.props.achievedValue / this.props.targetValue) * 100;
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.props.id,
      tenantId: this.props.tenantId,
      agentId: this.props.agentId,
      kpiType: this.props.kpiType,
      periodMonth: this.props.periodMonth,
      periodYear: this.props.periodYear,
      targetValue: this.props.targetValue,
      achievedValue: this.props.achievedValue,
      status: this.props.status,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
      version: this.props.version,
    };
  }
}
