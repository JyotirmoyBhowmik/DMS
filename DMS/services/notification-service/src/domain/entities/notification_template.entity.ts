import { randomUUID } from 'node:crypto';

export type NotificationChannel = 'EMAIL' | 'SMS' | 'PUSH' | 'WHATSAPP';
export type NotificationTemplateStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export class NotificationTemplateDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotificationTemplateDomainError';
  }
}

export class InvalidNotificationTemplateStateTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidNotificationTemplateStateTransitionError';
  }
}

export class NotificationTemplateValidationError extends Error {
  constructor(message: string, public readonly fields?: Record<string, string>) {
    super(message);
    this.name = 'NotificationTemplateValidationError';
  }
}

export interface NotificationTemplateProps {
  id?: string;
  tenantId: string;
  code: string;
  name: string;
  channel: NotificationChannel;
  subject?: string | null;
  bodyTemplate: string;
  status?: NotificationTemplateStatus;
  idempotencyKey?: string;
  version?: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export class NotificationTemplateAggregate {
  private readonly _id: string;
  private readonly _tenantId: string;
  private readonly _code: string;
  private _name: string;
  private readonly _channel: NotificationChannel;
  private _subject: string | null;
  private _bodyTemplate: string;
  private _status: NotificationTemplateStatus;
  private _idempotencyKey?: string;
  private _version: number;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  constructor(props: NotificationTemplateProps) {
    if (!props.tenantId || props.tenantId.trim().length === 0) {
      throw new NotificationTemplateDomainError('NotificationTemplate tenantId is required and cannot be empty');
    }

    if (!props.code || props.code.trim().length === 0) {
      throw new NotificationTemplateDomainError('NotificationTemplate code is required and cannot be empty');
    }

    if (!props.name || props.name.trim().length === 0) {
      throw new NotificationTemplateDomainError('NotificationTemplate name is required and cannot be empty');
    }

    const validChannels: NotificationChannel[] = ['EMAIL', 'SMS', 'PUSH', 'WHATSAPP'];
    if (!validChannels.includes(props.channel)) {
      throw new NotificationTemplateDomainError(`Invalid channel '${props.channel}'. Allowed: ${validChannels.join(', ')}`);
    }

    if (!props.bodyTemplate || props.bodyTemplate.trim().length === 0) {
      throw new NotificationTemplateDomainError('NotificationTemplate bodyTemplate is required and cannot be empty');
    }

    this._id = props.id || randomUUID();
    this._tenantId = props.tenantId;
    this._code = props.code.trim().toUpperCase();
    this._name = props.name.trim();
    this._channel = props.channel;
    this._subject = props.subject !== undefined ? (props.subject ? props.subject.trim() : null) : null;
    this._bodyTemplate = props.bodyTemplate.trim();
    this._status = props.status || 'ACTIVE';
    this._idempotencyKey = props.idempotencyKey;
    this._version = props.version || 1;
    this._createdAt = props.createdAt ? new Date(props.createdAt) : new Date();
    this._updatedAt = props.updatedAt ? new Date(props.updatedAt) : new Date();
  }

  get id(): string { return this._id; }
  get tenantId(): string { return this._tenantId; }
  get code(): string { return this._code; }
  get name(): string { return this._name; }
  get channel(): NotificationChannel { return this._channel; }
  get subject(): string | null { return this._subject; }
  get bodyTemplate(): string { return this._bodyTemplate; }
  get status(): NotificationTemplateStatus { return this._status; }
  get idempotencyKey(): string | undefined { return this._idempotencyKey; }
  get version(): number { return this._version; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }

  // State Machine methods
  activate(): void {
    if (this._status === 'ARCHIVED') {
      throw new InvalidNotificationTemplateStateTransitionError('Cannot activate an ARCHIVED notification template');
    }
    this._status = 'ACTIVE';
    this._updatedAt = new Date();
  }

  deactivate(): void {
    if (this._status === 'ARCHIVED') {
      throw new InvalidNotificationTemplateStateTransitionError('Cannot deactivate an ARCHIVED notification template');
    }
    this._status = 'INACTIVE';
    this._updatedAt = new Date();
  }

  archive(): void {
    this._status = 'ARCHIVED';
    this._updatedAt = new Date();
  }

  updateContent(name?: string, subject?: string | null, bodyTemplate?: string): void {
    if (this._status === 'ARCHIVED') {
      throw new InvalidNotificationTemplateStateTransitionError('Cannot update content of an ARCHIVED notification template');
    }

    if (name !== undefined) {
      if (!name || name.trim().length === 0) {
        throw new NotificationTemplateDomainError('Template name cannot be empty');
      }
      this._name = name.trim();
    }

    if (subject !== undefined) {
      this._subject = subject ? subject.trim() : null;
    }

    if (bodyTemplate !== undefined) {
      if (!bodyTemplate || bodyTemplate.trim().length === 0) {
        throw new NotificationTemplateDomainError('Body template cannot be empty');
      }
      this._bodyTemplate = bodyTemplate.trim();
    }

    this._updatedAt = new Date();
  }

  toJSON(): Record<string, any> {
    return {
      id: this._id,
      tenantId: this._tenantId,
      code: this._code,
      name: this._name,
      channel: this._channel,
      subject: this._subject,
      bodyTemplate: this._bodyTemplate,
      status: this._status,
      version: this._version,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
