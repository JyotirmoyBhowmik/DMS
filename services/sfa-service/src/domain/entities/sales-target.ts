import { Money } from '../value-objects/money.js';

export interface SalesTargetProps {
  id: string;
  tenantId: string;
  agentId: string;
  periodMonth: number;
  periodYear: number;
  targetAmount: Money;
  achievedAmount: Money;
  targetType: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
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
  }): SalesTarget {
    const now = new Date();
    return new SalesTarget({
      ...input,
      achievedAmount: Money.zero(input.targetAmount.currency),
      version: 1,
      createdAt: now,
      updatedAt: now,
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
  get version(): number { return this.props.version; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  /**
   * Update the achieved amount, usually after an order is processed.
   */
  addAchievement(amount: Money): void {
    this.props.achievedAmount = this.props.achievedAmount.add(amount);
    this.props.updatedAt = new Date();
  }

  get progressPercentage(): number {
    if (this.props.targetAmount.isZero()) return 100;
    return (this.props.achievedAmount.amount / this.props.targetAmount.amount) * 100;
  }
}
