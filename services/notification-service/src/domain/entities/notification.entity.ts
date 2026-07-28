// Notification aggregate root and domain state machine

export type NotificationChannel = 'EMAIL' | 'SMS' | 'PUSH' | 'WHATSAPP';
export type NotificationStatus = 'QUEUED' | 'PROCESSING' | 'SENT' | 'FAILED' | 'CANCELLED';

export interface NotificationProps {
  id: string;
  tenantId: string;
  templateId?: string | null;
  recipient: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  payload: Record<string, any>;
  errorMessage?: string | null;
  sentAt?: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export class NotificationAggregate {
  private props: NotificationProps;

  constructor(props: NotificationProps) {
    this.validateInvariants(props);
    this.props = { ...props };
  }

  private validateInvariants(props: NotificationProps): void {
    if (!props.id || props.id.trim().length === 0) {
      throw new Error('Notification ID is required.');
    }
    if (!props.tenantId || props.tenantId.trim().length === 0) {
      throw new Error('Tenant ID is required.');
    }
    if (!props.recipient || props.recipient.trim().length === 0) {
      throw new Error('Notification recipient is required.');
    }
    const validChannels: NotificationChannel[] = ['EMAIL', 'SMS', 'PUSH', 'WHATSAPP'];
    if (!validChannels.includes(props.channel)) {
      throw new Error(`Invalid notification channel: ${props.channel}`);
    }
    const validStatuses: NotificationStatus[] = ['QUEUED', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED'];
    if (!validStatuses.includes(props.status)) {
      throw new Error(`Invalid notification status: ${props.status}`);
    }
    if (typeof props.payload !== 'object' || props.payload === null) {
      throw new Error('Notification payload must be an object.');
    }
    if (props.version < 1) {
      throw new Error('Notification version must be >= 1.');
    }
  }

  public static create(props: Omit<NotificationProps, 'status' | 'version' | 'createdAt' | 'updatedAt'>): NotificationAggregate {
    const now = new Date();
    return new NotificationAggregate({
      ...props,
      status: 'QUEUED',
      version: 1,
      createdAt: now,
      updatedAt: now
    });
  }

  public get id(): string { return this.props.id; }
  public get tenantId(): string { return this.props.tenantId; }
  public get templateId(): string | null | undefined { return this.props.templateId; }
  public get recipient(): string { return this.props.recipient; }
  public get channel(): NotificationChannel { return this.props.channel; }
  public get status(): NotificationStatus { return this.props.status; }
  public get payload(): Record<string, any> { return { ...this.props.payload }; }
  public get errorMessage(): string | null | undefined { return this.props.errorMessage; }
  public get sentAt(): Date | null | undefined { return this.props.sentAt; }
  public get version(): number { return this.props.version; }
  public get createdAt(): Date { return this.props.createdAt; }
  public get updatedAt(): Date { return this.props.updatedAt; }

  public startProcessing(): void {
    if (this.props.status !== 'QUEUED') {
      throw new Error(`Cannot transition notification to PROCESSING from state ${this.props.status}.`);
    }
    this.props.status = 'PROCESSING';
    this.props.updatedAt = new Date();
  }

  public markAsSent(): void {
    if (this.props.status !== 'PROCESSING') {
      throw new Error(`Cannot transition notification to SENT from state ${this.props.status}.`);
    }
    this.props.status = 'SENT';
    this.props.sentAt = new Date();
    this.props.updatedAt = new Date();
  }

  public markAsFailed(errorMessage: string): void {
    if (this.props.status !== 'PROCESSING') {
      throw new Error(`Cannot transition notification to FAILED from state ${this.props.status}.`);
    }
    this.props.status = 'FAILED';
    this.props.errorMessage = errorMessage;
    this.props.updatedAt = new Date();
  }

  public cancel(): void {
    if (this.props.status !== 'QUEUED') {
      throw new Error(`Cannot transition notification to CANCELLED from state ${this.props.status}.`);
    }
    this.props.status = 'CANCELLED';
    this.props.updatedAt = new Date();
  }

  public updatePayload(payload: Record<string, any>, expectedVersion: number): void {
    if (this.props.version !== expectedVersion) {
      throw new Error(`Optimistic locking failure: expected version ${expectedVersion}, but found ${this.props.version}.`);
    }
    if (typeof payload !== 'object' || payload === null) {
      throw new Error('Notification payload must be an object.');
    }
    this.props.payload = { ...payload };
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  public toJSON(): NotificationProps {
    return { ...this.props };
  }
}
