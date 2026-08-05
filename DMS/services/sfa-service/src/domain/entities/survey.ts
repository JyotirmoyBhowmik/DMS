import { BusinessRuleViolationError } from '../errors/domain-error.js';

export interface SurveyProps {
  id: string;
  tenantId: string;
  agentId: string;
  outletId: string;
  title: string;
  description?: string;
  status?: string;
  createdAt?: Date;
  updatedAt?: Date;
  version?: number;
}

export class Survey {
  private props: Required<SurveyProps>;

  private constructor(props: SurveyProps) {
    this.validate(props);

    this.props = {
      id: props.id,
      tenantId: props.tenantId,
      agentId: props.agentId,
      outletId: props.outletId,
      title: props.title,
      description: props.description || '',
      status: props.status || 'DRAFT',
      createdAt: props.createdAt || new Date(),
      updatedAt: props.updatedAt || new Date(),
      version: props.version || 1,
    };
  }

  static create(props: SurveyProps): Survey {
    return new Survey(props);
  }

  private validate(props: SurveyProps): void {
    if (!props.id || props.id.trim().length === 0) {
      throw new BusinessRuleViolationError('Survey ID cannot be empty');
    }
    if (!props.tenantId || props.tenantId.trim().length === 0) {
      throw new BusinessRuleViolationError('Tenant ID cannot be empty');
    }
    if (!props.agentId || props.agentId.trim().length === 0) {
      throw new BusinessRuleViolationError('Agent ID cannot be empty');
    }
    if (!props.outletId || props.outletId.trim().length === 0) {
      throw new BusinessRuleViolationError('Outlet ID cannot be empty');
    }
    if (!props.title || props.title.trim().length === 0) {
      throw new BusinessRuleViolationError('Survey title cannot be empty');
    }
    if (props.title.length > 255) {
      throw new BusinessRuleViolationError('Survey title cannot exceed 255 characters');
    }
  }

  get id(): string { return this.props.id; }
  get tenantId(): string { return this.props.tenantId; }
  get agentId(): string { return this.props.agentId; }
  get outletId(): string { return this.props.outletId; }
  get title(): string { return this.props.title; }
  get description(): string { return this.props.description; }
  get status(): string { return this.props.status; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get version(): number { return this.props.version; }

  updateInfo(fields: { title?: string; description?: string }): void {
    if (this.props.status === 'COMPLETED' || this.props.status === 'CANCELLED') {
      throw new BusinessRuleViolationError(`Cannot update survey details in ${this.props.status} status`);
    }

    if (fields.title !== undefined) {
      if (fields.title.trim().length === 0) {
        throw new BusinessRuleViolationError('Survey title cannot be empty');
      }
      if (fields.title.length > 255) {
        throw new BusinessRuleViolationError('Survey title cannot exceed 255 characters');
      }
      this.props.title = fields.title;
    }

    if (fields.description !== undefined) {
      this.props.description = fields.description;
    }

    this.props.updatedAt = new Date();
  }

  activate(): void {
    if (this.props.status !== 'DRAFT') {
      throw new BusinessRuleViolationError(`Cannot activate survey from status ${this.props.status}`);
    }
    this.props.status = 'ACTIVE';
    this.props.updatedAt = new Date();
  }

  complete(): void {
    if (this.props.status !== 'ACTIVE') {
      throw new BusinessRuleViolationError(`Cannot complete survey unless it is ACTIVE (current status: ${this.props.status})`);
    }
    this.props.status = 'COMPLETED';
    this.props.updatedAt = new Date();
  }

  cancel(): void {
    if (this.props.status === 'COMPLETED') {
      throw new BusinessRuleViolationError('Cannot cancel a completed survey');
    }
    this.props.status = 'CANCELLED';
    this.props.updatedAt = new Date();
  }

  incrementVersion(): void {
    this.props.version += 1;
  }

  toJSON() {
    return {
      id: this.props.id,
      tenantId: this.props.tenantId,
      agentId: this.props.agentId,
      outletId: this.props.outletId,
      title: this.props.title,
      description: this.props.description,
      status: this.props.status,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
      version: this.props.version,
    };
  }
}
