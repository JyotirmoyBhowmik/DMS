import type { NotificationChannel } from './notification.js';

export interface TemplateProps {
  id: string;
  tenantId: string;
  name: string;
  channel: NotificationChannel;
  subject: string;
  bodyTemplate: string;
  variables: string[];
  locale: string;
  version: string;
  isActive: boolean;
}

export class NotificationTemplate {
  private props: TemplateProps;

  private constructor(props: TemplateProps) {
    this.props = { ...props };
  }

  static create(input: Omit<TemplateProps, 'isActive'>): NotificationTemplate {
    return new NotificationTemplate({ ...input, isActive: true });
  }

  static reconstitute(props: TemplateProps): NotificationTemplate {
    return new NotificationTemplate(props);
  }

  get id(): string { return this.props.id; }
  get tenantId(): string { return this.props.tenantId; }
  get name(): string { return this.props.name; }
  get channel(): NotificationChannel { return this.props.channel; }
  get subject(): string { return this.props.subject; }
  get bodyTemplate(): string { return this.props.bodyTemplate; }
  get variables(): string[] { return [...this.props.variables]; }
  get locale(): string { return this.props.locale; }
  get version(): string { return this.props.version; }
  get isActive(): boolean { return this.props.isActive; }

  deactivate(): void { this.props.isActive = false; }
  activate(): void { this.props.isActive = true; }

  render(data: Record<string, string>): { subject: string; body: string } {
    let renderedSubject = this.props.subject;
    let renderedBody = this.props.bodyTemplate;
    for (const [key, value] of Object.entries(data)) {
      const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      renderedSubject = renderedSubject.replace(pattern, value);
      renderedBody = renderedBody.replace(pattern, value);
    }
    return { subject: renderedSubject, body: renderedBody };
  }

  toJSON(): Record<string, unknown> {
    return { ...this.props };
  }
}
