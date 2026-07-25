import { randomUUID } from 'node:crypto';

export class RoleDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RoleDomainError';
  }
}

export class InvalidRoleStateTransitionError extends RoleDomainError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRoleStateTransitionError';
  }
}

export class RoleValidationError extends RoleDomainError {
  constructor(public readonly fields: Record<string, string>, message = 'Role validation failed') {
    const detail = Object.values(fields).join('; ');
    super(detail ? `${message}: ${detail}` : message);
    this.name = 'RoleValidationError';
  }
}

export type RoleStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export interface DomainEvent {
  id: string;
  name: string;
  occurredAt: Date;
  payload: Record<string, any>;
}

export interface RoleProps {
  id?: string;
  tenantId: string;
  name: string;
  description?: string;
  isSystem?: boolean;
  status?: RoleStatus;
  idempotencyKey?: string;
  version?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class RoleAggregate {
  private readonly _id: string;
  private readonly _tenantId: string;
  private _name: string;
  private _description?: string;
  private readonly _isSystem: boolean;
  private _status: RoleStatus;
  private readonly _idempotencyKey?: string;
  private _version: number;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: DomainEvent[] = [];

  constructor(props: RoleProps) {
    if (!props.tenantId) throw new RoleDomainError('tenantId is required');
    if (!props.name || props.name.trim().length === 0) {
      throw new RoleDomainError('name is required and cannot be empty');
    }

    this._id = props.id || randomUUID();
    this._tenantId = props.tenantId;
    this._name = props.name.trim();
    this._description = props.description;
    this._isSystem = props.isSystem || false;
    this._status = props.status || 'ACTIVE';
    this._idempotencyKey = props.idempotencyKey;
    this._version = props.version || 1;
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
  }

  get id(): string { return this._id; }
  get tenantId(): string { return this._tenantId; }
  get name(): string { return this._name; }
  get description(): string | undefined { return this._description; }
  get isSystem(): boolean { return this._isSystem; }
  get status(): RoleStatus { return this._status; }
  get idempotencyKey(): string | undefined { return this._idempotencyKey; }
  get version(): number { return this._version; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
  get domainEvents(): DomainEvent[] { return [...this._domainEvents]; }

  public clearEvents(): void {
    this._domainEvents = [];
  }

  public updateProfile(name: string, description?: string): void {
    if (this._isSystem) {
      throw new RoleDomainError('System roles cannot have their name modified');
    }
    if (!name || name.trim().length === 0) {
      throw new RoleDomainError('name cannot be empty');
    }
    this._name = name.trim();
    this._description = description;
    this._updatedAt = new Date();
  }

  public activate(): void {
    this.transitionTo('ACTIVE');
  }

  public deactivate(): void {
    this.transitionTo('INACTIVE');
  }

  public archive(): void {
    if (this._isSystem) {
      throw new InvalidRoleStateTransitionError('System roles cannot be archived');
    }
    this.transitionTo('ARCHIVED');
  }

  public transitionTo(newStatus: RoleStatus): void {
    if (this._status === newStatus) return;

    if (this._isSystem && newStatus === 'ARCHIVED') {
      throw new InvalidRoleStateTransitionError('System roles cannot be archived');
    }

    const validTransitions: Record<RoleStatus, RoleStatus[]> = {
      ACTIVE: ['INACTIVE', 'ARCHIVED'],
      INACTIVE: ['ACTIVE', 'ARCHIVED'],
      ARCHIVED: [], // Terminal state
    };

    const allowed = validTransitions[this._status] || [];
    if (!allowed.includes(newStatus)) {
      throw new InvalidRoleStateTransitionError(
        `Cannot transition Role from state '${this._status}' to '${newStatus}'`
      );
    }

    const oldStatus = this._status;
    this._status = newStatus;
    this._updatedAt = new Date();

    this._domainEvents.push({
      id: randomUUID(),
      name: `identity.role.${newStatus.toLowerCase()}`,
      occurredAt: new Date(),
      payload: {
        roleId: this._id,
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
      description: this._description,
      isSystem: this._isSystem,
      status: this._status,
      idempotencyKey: this._idempotencyKey,
      version: this._version,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
