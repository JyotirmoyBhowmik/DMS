import { Money } from '../value-objects/money';

/**
 * OrderApproval domain entity.
 * Multi-level order approval workflow extending the order aggregate.
 * Business rules: auto-approve below threshold, escalate if above.
 */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'escalated';
export type ApprovalLevel = 1 | 2 | 3;

export interface OrderApprovalProps {
  id: string;
  tenantId: string;
  orderId: string;
  requestedBy: string;
  approvedBy: string | null;
  approvalLevel: ApprovalLevel;
  thresholdAmount: Money;
  status: ApprovalStatus;
  comments: string | null;
  requestedAt: Date;
  decidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export class OrderApproval {
  private props: OrderApprovalProps;

  private constructor(props: OrderApprovalProps) {
    this.props = { ...props };
  }

  static create(input: {
    id: string;
    tenantId: string;
    orderId: string;
    requestedBy: string;
    approvalLevel?: ApprovalLevel;
    thresholdAmount: Money;
    orderAmount: Money;
  }): OrderApproval {
    const now = new Date();
    const level = input.approvalLevel ?? 1;

    const approval = new OrderApproval({
      id: input.id,
      tenantId: input.tenantId,
      orderId: input.orderId,
      requestedBy: input.requestedBy,
      approvedBy: null,
      approvalLevel: level,
      thresholdAmount: input.thresholdAmount,
      status: 'pending',
      comments: null,
      requestedAt: now,
      decidedAt: null,
      createdAt: now,
      updatedAt: now,
      version: 0,
    });

    // Business rule: auto-approve if order amount is below threshold
    if (input.orderAmount.lessThanOrEqual(input.thresholdAmount)) {
      approval.props.status = 'approved';
      approval.props.approvedBy = 'SYSTEM_AUTO_APPROVE';
      approval.props.decidedAt = now;
      approval.props.comments = 'Auto-approved: order amount within threshold';
    }

    return approval;
  }

  static reconstitute(props: OrderApprovalProps): OrderApproval {
    return new OrderApproval(props);
  }

  // ── Accessors ──────────────────────────────────────────────────
  get id(): string { return this.props.id; }
  get tenantId(): string { return this.props.tenantId; }
  get orderId(): string { return this.props.orderId; }
  get requestedBy(): string { return this.props.requestedBy; }
  get approvedBy(): string | null { return this.props.approvedBy; }
  get approvalLevel(): ApprovalLevel { return this.props.approvalLevel; }
  get thresholdAmount(): Money { return this.props.thresholdAmount; }
  get status(): ApprovalStatus { return this.props.status; }
  get comments(): string | null { return this.props.comments; }
  get requestedAt(): Date { return this.props.requestedAt; }
  get decidedAt(): Date | null { return this.props.decidedAt; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get version(): number { return this.props.version; }

  // ── State Transitions ─────────────────────────────────────────
  approve(approvedBy: string, comments?: string): void {
    if (this.props.status !== 'pending') {
      throw new Error(`Cannot approve from state: ${this.props.status}`);
    }
    const now = new Date();
    this.props.status = 'approved';
    this.props.approvedBy = approvedBy;
    this.props.decidedAt = now;
    this.props.comments = comments ?? null;
    this.props.updatedAt = now;
  }

  reject(approvedBy: string, comments?: string): void {
    if (this.props.status !== 'pending') {
      throw new Error(`Cannot reject from state: ${this.props.status}`);
    }
    const now = new Date();
    this.props.status = 'rejected';
    this.props.approvedBy = approvedBy;
    this.props.decidedAt = now;
    this.props.comments = comments ?? null;
    this.props.updatedAt = now;
  }

  /** Escalate to next approval level */
  escalate(): void {
    if (this.props.status !== 'pending') {
      throw new Error(`Cannot escalate from state: ${this.props.status}`);
    }
    if (this.props.approvalLevel >= 3) {
      throw new Error('Cannot escalate beyond approval level 3');
    }
    this.props.status = 'escalated';
    this.props.updatedAt = new Date();
  }

  /** Next level after escalation */
  nextLevel(): ApprovalLevel {
    if (this.props.approvalLevel >= 3) {
      throw new Error('Already at maximum approval level');
    }
    return (this.props.approvalLevel + 1) as ApprovalLevel;
  }

  incrementVersion(): void {
    this.props.version += 1;
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.props.id,
      tenantId: this.props.tenantId,
      orderId: this.props.orderId,
      requestedBy: this.props.requestedBy,
      approvedBy: this.props.approvedBy,
      approvalLevel: this.props.approvalLevel,
      thresholdAmount: this.props.thresholdAmount.toJSON(),
      status: this.props.status,
      comments: this.props.comments,
      requestedAt: this.props.requestedAt.toISOString(),
      decidedAt: this.props.decidedAt?.toISOString() ?? null,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
      version: this.props.version,
    };
  }
}
