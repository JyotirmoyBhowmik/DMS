import { randomUUID } from 'node:crypto';

export class UserDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserDomainError';
  }
}

export class InvalidUserStateTransitionError extends UserDomainError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidUserStateTransitionError';
  }
}

export class UserValidationError extends UserDomainError {
  constructor(public readonly fields: Record<string, string>, message = 'User validation failed') {
    const detail = Object.values(fields).join('; ');
    super(detail ? `${message}: ${detail}` : message);
    this.name = 'UserValidationError';
  }
}

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'LOCKED';

export interface DomainEvent {
  id: string;
  name: string;
  occurredAt: Date;
  payload: Record<string, any>;
}

export interface UserProps {
  id?: string;
  tenantId: string;
  email: string;
  passwordHash: string;
  firstName?: string;
  lastName?: string;
  roles?: string[];
  status?: UserStatus;
  idempotencyKey?: string;
  version?: number;
  createdAt?: Date;
  updatedAt?: Date;
  lastLoginAt?: Date;
}

export class UserAggregate {
  private readonly _id: string;
  private readonly _tenantId: string;
  private readonly _email: string;
  private _passwordHash: string;
  private _firstName?: string;
  private _lastName?: string;
  private _roles: string[];
  private _status: UserStatus;
  private readonly _idempotencyKey?: string;
  private _version: number;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _lastLoginAt?: Date;
  private _domainEvents: DomainEvent[] = [];

  constructor(props: UserProps) {
    if (!props.tenantId) throw new UserDomainError('tenantId is required');
    if (!props.email || props.email.trim().length === 0) {
      throw new UserDomainError('email is required');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(props.email)) {
      throw new UserDomainError(`Invalid email format '${props.email}'`);
    }
    if (!props.passwordHash || props.passwordHash.trim().length === 0) {
      throw new UserDomainError('passwordHash is required');
    }

    this._id = props.id || randomUUID();
    this._tenantId = props.tenantId;
    this._email = props.email.toLowerCase().trim();
    this._passwordHash = props.passwordHash;
    this._firstName = props.firstName;
    this._lastName = props.lastName;
    this._roles = props.roles || ['user'];
    this._status = props.status || 'ACTIVE';
    this._idempotencyKey = props.idempotencyKey;
    this._version = props.version || 1;
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
    this._lastLoginAt = props.lastLoginAt;
  }

  get id(): string { return this._id; }
  get tenantId(): string { return this._tenantId; }
  get email(): string { return this._email; }
  get passwordHash(): string { return this._passwordHash; }
  get firstName(): string | undefined { return this._firstName; }
  get lastName(): string | undefined { return this._lastName; }
  get roles(): string[] { return [...this._roles]; }
  get status(): UserStatus { return this._status; }
  get idempotencyKey(): string | undefined { return this._idempotencyKey; }
  get version(): number { return this._version; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
  get lastLoginAt(): Date | undefined { return this._lastLoginAt; }
  get domainEvents(): DomainEvent[] { return [...this._domainEvents]; }

  public clearEvents(): void {
    this._domainEvents = [];
  }

  public updatePassword(newPasswordHash: string): void {
    if (!newPasswordHash || newPasswordHash.trim().length === 0) {
      throw new UserDomainError('newPasswordHash is required');
    }
    this._passwordHash = newPasswordHash;
    this._updatedAt = new Date();
  }

  public recordLogin(): void {
    this._lastLoginAt = new Date();
    this._updatedAt = new Date();
  }

  public activate(): void {
    this.transitionTo('ACTIVE');
  }

  public deactivate(): void {
    this.transitionTo('INACTIVE');
  }

  public suspend(): void {
    this.transitionTo('SUSPENDED');
  }

  public lock(): void {
    this.transitionTo('LOCKED');
  }

  public transitionTo(newStatus: UserStatus): void {
    if (this._status === newStatus) return;

    const validTransitions: Record<UserStatus, UserStatus[]> = {
      ACTIVE: ['INACTIVE', 'SUSPENDED', 'LOCKED'],
      INACTIVE: ['ACTIVE'],
      SUSPENDED: ['ACTIVE', 'INACTIVE'],
      LOCKED: ['ACTIVE'],
    };

    const allowed = validTransitions[this._status] || [];
    if (!allowed.includes(newStatus)) {
      throw new InvalidUserStateTransitionError(
        `Cannot transition User from state '${this._status}' to '${newStatus}'`
      );
    }

    const oldStatus = this._status;
    this._status = newStatus;
    this._updatedAt = new Date();

    this._domainEvents.push({
      id: randomUUID(),
      name: `identity.user.${newStatus.toLowerCase()}`,
      occurredAt: new Date(),
      payload: {
        userId: this._id,
        tenantId: this._tenantId,
        email: this._email,
        oldStatus,
        newStatus,
        version: this._version,
      },
    });
  }

  public toJSON(redactSensitive = true) {
    return {
      id: this._id,
      tenantId: this._tenantId,
      email: this._email,
      firstName: this._firstName,
      lastName: this._lastName,
      roles: this._roles,
      status: this._status,
      ...(redactSensitive ? {} : { passwordHash: this._passwordHash }),
      idempotencyKey: this._idempotencyKey,
      version: this._version,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
      lastLoginAt: this._lastLoginAt ? this._lastLoginAt.toISOString() : undefined,
    };
  }
}
