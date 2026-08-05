import { Money } from '../value-objects/money.js';

export type SalesTargetStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';

export interface SalesTargetProps {
  id: string;
  tenantId: string;
  agentId: string;
  periodMonth: number; // 1-12
  periodYear: number;
  targetAmount: Money;
  achievedAmount: Money;
  targetType: string;
  status: SalesTargetStatus;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export class SalesTarget {
  private props: SalesTargetProps;

  private constructor(props: SalesTargetProps) {
    this.props = { ...props };
  }

  static create(input: {
    id: string;
    tenantId: string;
    agentId: string;
    periodMonth: number;
    periodYear: number;
    targetAmount: Money;
    targetType: string;
    status?: SalesTargetStatus;
  }): SalesTarget {
    if (!input.id || input.id.trim().length === 0) throw new Error('ID cannot be empty');
    if (!input.tenantId || input.tenantId.trim().length === 0) throw new Error('tenantId cannot be empty');
    if (!input.agentId || input.agentId.trim().length === 0) throw new Error('agentId cannot be empty');
    
    if (input.periodMonth < 1 || input.periodMonth > 12) {
      throw new Error('periodMonth must be between 1 and 12');
    }
    if (input.periodYear < 2000 || input.periodYear > 2100) {
      throw new Error('periodYear must be a valid year between 2000 and 2100');
    }

    if (input.targetAmount.amount < 0) {
      throw new Error('Target amount cannot be negative');
    }

    const now = new Date();
    return new SalesTarget({
      id: input.id,
      tenantId: input.tenantId,
      agentId: input.agentId,
      periodMonth: input.periodMonth,
      periodYear: input.periodYear,
      targetAmount: input.targetAmount,
      achievedAmount: Money.zero(input.targetAmount.currency),
      targetType: input.targetType,
      status: input.status ?? 'DRAFT',
      createdAt: now,
      updatedAt: now,
      version: 0,
    });
  }

  static fromPersistence(props: SalesTargetProps): SalesTarget {
    return new SalesTarget(props);
  }

  get id(): string { return this.props.id; }
  get tenantId(): string { return this.props.tenantId; }
  get agentId(): string { return this.props.agentId; }
  get periodMonth(): number { return this.props.periodMonth; }
  get periodYear(): number { return this.props.periodYear; }
  get targetAmount(): Money { return this.props.targetAmount; }
  get achievedAmount(): Money { return this.props.achievedAmount; }
  get targetType(): string { return this.props.targetType; }
  get status(): SalesTargetStatus { return this.props.status; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get version(): number { return this.props.version; }

  // State transitions
  activate(): void {
    if (this.props.status !== 'DRAFT') {
      throw new Error(`Cannot activate sales target from status '${this.props.status}'`);
    }
    this.props.status = 'ACTIVE';
    this.props.updatedAt = new Date();
  }

  complete(): void {
    if (this.props.status !== 'ACTIVE') {
      throw new Error(`Cannot complete sales target from status '${this.props.status}'`);
    }
    this.props.status = 'COMPLETED';
    this.props.updatedAt = new Date();
  }

  cancel(): void {
    if (this.props.status === 'COMPLETED' || this.props.status === 'EXPIRED') {
      throw new Error(`Cannot cancel sales target from status '${this.props.status}'`);
    }
    this.props.status = 'CANCELLED';
    this.props.updatedAt = new Date();
  }

  expire(): void {
    if (this.props.status !== 'ACTIVE') {
      throw new Error(`Cannot expire sales target from status '${this.props.status}'`);
    }
    this.props.status = 'EXPIRED';
    this.props.updatedAt = new Date();
  }

  // Mutation
  addAchievement(amount: Money): void {
    if (this.props.status !== 'ACTIVE') {
      throw new Error('Can only add achievement to ACTIVE sales targets');
    }
    if (amount.amount < 0) {
      throw new Error('Achievement amount cannot be negative');
    }
    this.props.achievedAmount = this.props.achievedAmount.add(amount);
    this.props.updatedAt = new Date();

    // Check completion threshold
    if (this.progressPercentage >= 100) {
      this.complete();
    }
  }

  updateTargetAmount(amount: Money): void {
    if (this.props.status !== 'DRAFT') {
      throw new Error('Can only modify target amount in DRAFT status');
    }
    if (amount.amount < 0) {
      throw new Error('Target amount cannot be negative');
    }
    this.props.targetAmount = amount;
    this.props.updatedAt = new Date();
  }

  incrementVersion(): void {
    this.props.version += 1;
  }

  get progressPercentage(): number {
    if (this.props.targetAmount.isZero()) return 100;
    return (this.props.achievedAmount.amount / this.props.targetAmount.amount) * 100;
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.props.id,
      tenantId: this.props.tenantId,
      agentId: this.props.agentId,
      periodMonth: this.props.periodMonth,
      periodYear: this.props.periodYear,
      targetAmount: this.props.targetAmount.amount,
      achievedAmount: this.props.achievedAmount.amount,
      targetType: this.props.targetType,
      status: this.props.status,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
      version: this.props.version,
    };
  }
}
