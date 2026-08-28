import { randomUUID } from 'node:crypto';

export type MfaType = 'TOTP' | 'SMS' | 'EMAIL' | 'SECURITY_KEY';

export class MFADeviceDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MFADeviceDomainError';
  }
}

export class InvalidMFADeviceStateTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidMFADeviceStateTransitionError';
  }
}

export class MFADeviceValidationError extends Error {
  constructor(
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'MFADeviceValidationError';
  }
}

export interface MFADeviceProps {
  id?: string;
  tenantId: string;
  userId: string;
  type: MfaType;
  secretEncrypted: string;
  isActive?: boolean;
  lastUsedAt?: string | Date | null;
  idempotencyKey?: string;
  version?: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export class MFADeviceAggregate {
  private readonly _id: string;
  private readonly _tenantId: string;
  private readonly _userId: string;
  private readonly _type: MfaType;
  private _secretEncrypted: string;
  private _isActive: boolean;
  private _lastUsedAt: Date | null;
  private _idempotencyKey?: string;
  private _version: number;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  constructor(props: MFADeviceProps) {
    if (!props.tenantId || props.tenantId.trim().length === 0) {
      throw new MFADeviceDomainError('MFADevice tenantId is required and cannot be empty');
    }

    if (!props.userId || props.userId.trim().length === 0) {
      throw new MFADeviceDomainError('MFADevice userId is required and cannot be empty');
    }

    const validTypes: MfaType[] = ['TOTP', 'SMS', 'EMAIL', 'SECURITY_KEY'];
    if (!validTypes.includes(props.type)) {
      throw new MFADeviceDomainError(
        `Invalid MFADevice type '${props.type}'. Allowed types: ${validTypes.join(', ')}`,
      );
    }

    if (!props.secretEncrypted || props.secretEncrypted.trim().length === 0) {
      throw new MFADeviceDomainError('MFADevice secretEncrypted is required and cannot be empty');
    }

    this._id = props.id || randomUUID();
    this._tenantId = props.tenantId;
    this._userId = props.userId;
    this._type = props.type;
    this._secretEncrypted = props.secretEncrypted;
    this._isActive = props.isActive !== undefined ? props.isActive : true;
    this._lastUsedAt = props.lastUsedAt ? new Date(props.lastUsedAt) : null;
    this._idempotencyKey = props.idempotencyKey;
    this._version = props.version || 1;
    this._createdAt = props.createdAt ? new Date(props.createdAt) : new Date();
    this._updatedAt = props.updatedAt ? new Date(props.updatedAt) : new Date();
  }

  get id(): string {
    return this._id;
  }
  get tenantId(): string {
    return this._tenantId;
  }
  get userId(): string {
    return this._userId;
  }
  get type(): MfaType {
    return this._type;
  }
  get secretEncrypted(): string {
    return this._secretEncrypted;
  }
  get isActive(): boolean {
    return this._isActive;
  }
  get lastUsedAt(): Date | null {
    return this._lastUsedAt;
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

  // State Machine methods
  activate(): void {
    if (this._isActive) {
      return; // Idempotent activation
    }
    this._isActive = true;
    this._updatedAt = new Date();
  }

  deactivate(): void {
    if (!this._isActive) {
      return; // Idempotent deactivation
    }
    this._isActive = false;
    this._updatedAt = new Date();
  }

  updateSecret(newSecretEncrypted: string): void {
    if (!newSecretEncrypted || newSecretEncrypted.trim().length === 0) {
      throw new MFADeviceDomainError('New secretEncrypted cannot be empty');
    }
    this._secretEncrypted = newSecretEncrypted;
    this._updatedAt = new Date();
  }

  recordUse(): void {
    if (!this._isActive) {
      throw new InvalidMFADeviceStateTransitionError(
        'Cannot record usage of an inactive MFA device',
      );
    }
    this._lastUsedAt = new Date();
    this._updatedAt = new Date();
  }

  toJSON(redactSecret = true): Record<string, any> {
    return {
      id: this._id,
      tenantId: this._tenantId,
      userId: this._userId,
      type: this._type,
      secretEncrypted: redactSecret ? '[REDACTED]' : this._secretEncrypted,
      isActive: this._isActive,
      lastUsedAt: this._lastUsedAt ? this._lastUsedAt.toISOString() : null,
      version: this._version,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
