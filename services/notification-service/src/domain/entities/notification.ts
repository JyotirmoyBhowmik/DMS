export type NotificationChannel = 'email' | 'sms' | 'push' | 'in_app';
export type NotificationStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'bounced';

export interface NotificationProps {
  id: string;
  tenantId: string;
  recipientId: string;
  channel: NotificationChannel;
  templateId: string;
  subject: string;
  body: string;
  data: Record<string, string>;
  status: NotificationStatus;
  sentAt: string | null;
  deliveredAt: string | null;
  failureReason: string | null;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
}

export class Notification {
  private props: NotificationProps;

  private constructor(props: NotificationProps) {
    this.props = { ...props };
  }

  static create(input: {
    id: string; tenantId: string; recipientId: string; channel: NotificationChannel;
    templateId: string; subject: string; body: string; data?: Record<string, string>;
    maxRetries?: number;
  }): Notification {
    return new Notification({
      ...input,
      data: input.data ?? {},
      status: 'queued',
      sentAt: null,
      deliveredAt: null,
      failureReason: null,
      retryCount: 0,
      maxRetries: input.maxRetries ?? 3,
      createdAt: new Date().toISOString(),
    });
  }

  static reconstitute(props: NotificationProps): Notification {
    return new Notification(props);
  }

  get id(): string { return this.props.id; }
  get tenantId(): string { return this.props.tenantId; }
  get recipientId(): string { return this.props.recipientId; }
  get channel(): NotificationChannel { return this.props.channel; }
  get templateId(): string { return this.props.templateId; }
  get subject(): string { return this.props.subject; }
  get body(): string { return this.props.body; }
  get data(): Record<string, string> { return this.props.data; }
  get status(): NotificationStatus { return this.props.status; }
  get sentAt(): string | null { return this.props.sentAt; }
  get deliveredAt(): string | null { return this.props.deliveredAt; }
  get retryCount(): number { return this.props.retryCount; }
  get canRetry(): boolean { return this.props.retryCount < this.props.maxRetries; }

  markSent(): void {
    this.props.status = 'sent';
    this.props.sentAt = new Date().toISOString();
  }

  markDelivered(): void {
    this.props.status = 'delivered';
    this.props.deliveredAt = new Date().toISOString();
  }

  markFailed(reason: string): void {
    this.props.status = 'failed';
    this.props.failureReason = reason;
  }

  markBounced(): void {
    this.props.status = 'bounced';
  }

  incrementRetry(): void {
    this.props.retryCount++;
    this.props.status = 'queued';
    this.props.failureReason = null;
  }

  toJSON(): Record<string, unknown> {
    return { ...this.props };
  }
}
