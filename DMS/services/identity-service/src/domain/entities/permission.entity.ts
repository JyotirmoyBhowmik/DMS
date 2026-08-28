import { randomUUID } from 'node:crypto';

export class PermissionDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionDomainError';
  }
}

export class InvalidPermissionStateTransitionError extends PermissionDomainError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPermissionStateTransitionError';
  }
}

export class PermissionValidationError extends PermissionDomainError {
  constructor(
    public readonly fields: Record<string, string>,
    message = 'Permission validation failed',
  ) {
    const detail = Object.values(fields).join('; ');
    super(detail ? `${message}: ${detail}` : message);
    this.name = 'PermissionValidationError';
  }
}

export type PermissionStatus = 'ACTIVE' | 'INACTIVE' | 'DEPRECATED';

export interface DomainEvent {
  id: string;
  name: string;
  occurredAt: Date;
  payload: Record<string, any>;
}

export interface PermissionProps {
  id?: string;
  tenantId: string;
  name: string;
  resource: string;
  action: string;
  description?: string;
  status?: PermissionStatus;
  idempotencyKey?: string;
  version?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class PermissionAggregate {
  private readonly _id: string;
  private readonly _tenantId: string;
  private _name: string;
  private _resource: string;
  private _action: string;
  private _description?: string;
  private _status: PermissionStatus;
  private readonly _idempotencyKey?: string;
  private _version: number;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: DomainEvent[] = [];

  constructor(props: PermissionProps) {
    if (!props.tenantId) throw new PermissionDomainError('tenantId is required');
    if (!props.name || props.name.trim().length === 0) {
      throw new PermissionDomainError('name is required and cannot be empty');
    }
    if (!props.resource || props.resource.trim().length === 0) {
      throw new PermissionDomainError('resource is required and cannot be empty');
    }
    if (!props.action || props.action.trim().length === 0) {
      throw new PermissionDomainError('action is required and cannot be empty');
    }

    this._id = props.id || randomUUID();
    this._tenantId = props.tenantId;
    this._name = props.name.trim();
    this._resource = props.resource.trim();
    this._action = props.action.trim();
    this._description = props.description;
    this._status = props.status || 'ACTIVE';
    this._idempotencyKey = props.idempotencyKey;
    this._version = props.version || 1;
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
  }

  get id(): string {
    return this._id;
  }
  get tenantId(): string {
    return this._tenantId;
  }
  get name(): string {
    return this._name;
  }
  get resource(): string {
    return this._resource;
  }
  get action(): string {
    return this._action;
  }
  get description(): string | undefined {
    return this._description;
  }
  get status(): PermissionStatus {
    return this._status;
  }
  get idempotencyKey(): string | undefined {
    return this._idempotencyKey;
  }
  get version(): number {
    return this._version;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }
  get domainEvents(): DomainEvent[] {
    return [...this._domainEvents];
  }

  public clearEvents(): void {
    this._domainEvents = [];
  }

  public updateProfile(name: string, resource: string, action: string, description?: string): void {
    if (!name || name.trim().length === 0) {
      throw new PermissionDomainError('name cannot be empty');
    }
    if (!resource || resource.trim().length === 0) {
      throw new PermissionDomainError('resource cannot be empty');
    }
    if (!action || action.trim().length === 0) {
      throw new PermissionDomainError('action cannot be empty');
    }
    this._name = name.trim();
    this._resource = resource.trim();
    this._action = action.trim();
    this._description = description;
    this._updatedAt = new Date();
  }

  public activate(): void {
    this.transitionTo('ACTIVE');
  }

  public deactivate(): void {
    this.transitionTo('INACTIVE');
  }

  public deprecate(): void {
    this.transitionTo('DEPRECATED');
  }

  public transitionTo(newStatus: PermissionStatus): void {
    if (this._status === newStatus) return;

    const validTransitions: Record<PermissionStatus, PermissionStatus[]> = {
      ACTIVE: ['INACTIVE', 'DEPRECATED'],
      INACTIVE: ['ACTIVE', 'DEPRECATED'],
      DEPRECATED: [], // Terminal state
    };

    const allowed = validTransitions[this._status] || [];
    if (!allowed.includes(newStatus)) {
      throw new InvalidPermissionStateTransitionError(
        `Cannot transition Permission from state '${this._status}' to '${newStatus}'`,
      );
    }

    const oldStatus = this._status;
    this._status = newStatus;
    this._updatedAt = new Date();

    this._domainEvents.push({
      id: randomUUID(),
      name: `identity.permission.${newStatus.toLowerCase()}`,
      occurredAt: new Date(),
      payload: {
        permissionId: this._id,
        tenantId: this._tenantId,
        name: this._name,
        oldStatus,
        newStatus,
        version: this._version,
      },
    });
  }

  public toJSON() {
    return {
      id: this._id,
      tenantId: this._tenantId,
      name: this._name,
      resource: this._resource,
      action: this._action,
      description: this._description,
      status: this._status,
      idempotencyKey: this._idempotencyKey,
      version: this._version,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
