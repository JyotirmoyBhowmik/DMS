import { randomUUID } from 'node:crypto';
import { Notification, NotificationTemplate } from '../../../domain/entities/index.js';
import type { NotificationChannel, NotificationProps } from '../../../domain/entities/notification.js';
import type { TemplateProps } from '../../../domain/entities/template.js';
import { TemplateNotFoundError, ChannelUnavailableError } from '../../../domain/errors/notification.errors.js';

// ── Channel Adapters ────────────────────────────────────────────
interface ChannelAdapter {
  readonly channel: NotificationChannel;
  send(to: string, subject: string, body: string, data: Record<string, string>): Promise<{ success: boolean; externalId?: string; error?: string }>;
}

class EmailAdapter implements ChannelAdapter {
  readonly channel: NotificationChannel = 'email';
  async send(to: string, subject: string, body: string): Promise<{ success: boolean; externalId?: string }> {
    const externalId = `email-${randomUUID().slice(0, 8)}`;
    process.stdout.write(`  📧 [EMAIL] To: ${to} | Subject: ${subject} | Body: ${body.slice(0, 50)}... | ID: ${externalId}\n`);
    return { success: true, externalId };
  }
}

class SmsAdapter implements ChannelAdapter {
  readonly channel: NotificationChannel = 'sms';
  async send(to: string, _subject: string, body: string): Promise<{ success: boolean; externalId?: string }> {
    const externalId = `sms-${randomUUID().slice(0, 8)}`;
    process.stdout.write(`  📱 [SMS] To: ${to} | Body: ${body.slice(0, 50)}... | ID: ${externalId}\n`);
    return { success: true, externalId };
  }
}

class PushAdapter implements ChannelAdapter {
  readonly channel: NotificationChannel = 'push';
  async send(to: string, subject: string, body: string): Promise<{ success: boolean; externalId?: string }> {
    const externalId = `push-${randomUUID().slice(0, 8)}`;
    process.stdout.write(`  🔔 [PUSH] To: ${to} | Title: ${subject} | Body: ${body.slice(0, 50)}... | ID: ${externalId}\n`);
    return { success: true, externalId };
  }
}

class InAppAdapter implements ChannelAdapter {
  readonly channel: NotificationChannel = 'in_app';
  async send(to: string, subject: string, body: string): Promise<{ success: boolean; externalId?: string }> {
    const externalId = `inapp-${randomUUID().slice(0, 8)}`;
    process.stdout.write(`  💬 [IN-APP] To: ${to} | Title: ${subject} | Body: ${body.slice(0, 50)}... | ID: ${externalId}\n`);
    return { success: true, externalId };
  }
}

// ── Repositories ────────────────────────────────────────────────
class InMemoryNotificationRepository {
  private store = new Map<string, NotificationProps>();

  async save(notification: Notification): Promise<void> {
    this.store.set(notification.id, notification.toJSON() as unknown as NotificationProps);
  }

  async findById(id: string): Promise<Notification | null> {
    const data = this.store.get(id);
    return data ? Notification.reconstitute(data) : null;
  }

  async findByRecipient(recipientId: string, limit = 20): Promise<Notification[]> {
    return Array.from(this.store.values())
      .filter((n) => n.recipientId === recipientId)
      .slice(0, limit)
      .map((n) => Notification.reconstitute(n));
  }
}

class InMemoryTemplateRepository {
  private store = new Map<string, TemplateProps>();

  constructor() {
    this.seed();
  }

  private seed(): void {
    const templates: TemplateProps[] = [
      {
        id: 'tpl-order-confirmation', tenantId: '*', name: 'Order Confirmation', channel: 'email',
        subject: 'Order {{orderId}} Confirmed', bodyTemplate: 'Dear {{customerName}}, your order {{orderId}} for {{amount}} has been confirmed. Expected delivery: {{deliveryDate}}.',
        variables: ['orderId', 'customerName', 'amount', 'deliveryDate'], locale: 'en', version: '1', isActive: true,
      },
      {
        id: 'tpl-visit-reminder', tenantId: '*', name: 'Visit Reminder', channel: 'push',
        subject: 'Visit Reminder', bodyTemplate: 'You have a scheduled visit to {{outletName}} at {{time}} today.',
        variables: ['outletName', 'time'], locale: 'en', version: '1', isActive: true,
      },
      {
        id: 'tpl-payment-received', tenantId: '*', name: 'Payment Received', channel: 'sms',
        subject: 'Payment Received', bodyTemplate: 'Payment of {{amount}} received from {{outletName}}. Ref: {{refNo}}.',
        variables: ['amount', 'outletName', 'refNo'], locale: 'en', version: '1', isActive: true,
      },
      {
        id: 'tpl-claim-update', tenantId: '*', name: 'Claim Status Update', channel: 'in_app',
        subject: 'Claim {{claimId}} Updated', bodyTemplate: 'Your claim {{claimId}} status has been updated to {{status}}. Amount: {{amount}}.',
        variables: ['claimId', 'status', 'amount'], locale: 'en', version: '1', isActive: true,
      },
    ];

    for (const t of templates) {
      this.store.set(t.id, t);
    }
  }

  async findById(id: string): Promise<NotificationTemplate | null> {
    const data = this.store.get(id);
    return data ? NotificationTemplate.reconstitute(data) : null;
  }

  async save(template: NotificationTemplate): Promise<void> {
    this.store.set(template.id, template.toJSON() as unknown as TemplateProps);
  }

  async findAll(): Promise<NotificationTemplate[]> {
    return Array.from(this.store.values()).map((d) => NotificationTemplate.reconstitute(d));
  }
}

// ── Controller ────────────────────────────────────────────────
export class NotificationController {
  private readonly notifRepo: InMemoryNotificationRepository;
  private readonly templateRepo: InMemoryTemplateRepository;
  private readonly adapters: Map<NotificationChannel, ChannelAdapter>;

  constructor() {
    this.notifRepo = new InMemoryNotificationRepository();
    this.templateRepo = new InMemoryTemplateRepository();
    this.adapters = new Map();
    this.adapters.set('email', new EmailAdapter());
    this.adapters.set('sms', new SmsAdapter());
    this.adapters.set('push', new PushAdapter());
    this.adapters.set('in_app', new InAppAdapter());
  }

  async handleSendNotification(body: {
    tenantId: string; recipientId: string; templateId: string; channel: NotificationChannel;
    data: Record<string, string>;
  }): Promise<{ status: number; body: Record<string, unknown> }> {
    const template = await this.templateRepo.findById(body.templateId);
    if (!template) {
      return { status: 404, body: { error: `Template '${body.templateId}' not found`, code: 'TEMPLATE_NOT_FOUND' } };
    }

    const adapter = this.adapters.get(body.channel);
    if (!adapter) {
      return { status: 400, body: { error: `Channel '${body.channel}' unavailable`, code: 'CHANNEL_UNAVAILABLE' } };
    }

    const rendered = template.render(body.data);

    const notification = Notification.create({
      id: randomUUID(),
      tenantId: body.tenantId,
      recipientId: body.recipientId,
      channel: body.channel,
      templateId: body.templateId,
      subject: rendered.subject,
      body: rendered.body,
      data: body.data,
    });

    const result = await adapter.send(body.recipientId, rendered.subject, rendered.body, body.data);

    if (result.success) {
      notification.markSent();
    } else {
      notification.markFailed(result.error ?? 'Unknown delivery failure');
    }

    await this.notifRepo.save(notification);
    return { status: 200, body: notification.toJSON() };
  }

  async handleGetNotification(id: string): Promise<{ status: number; body: Record<string, unknown> }> {
    const notif = await this.notifRepo.findById(id);
    if (!notif) return { status: 404, body: { error: 'Notification not found' } };
    return { status: 200, body: notif.toJSON() };
  }

  async handleListTemplates(): Promise<{ status: number; body: Record<string, unknown> }> {
    const templates = await this.templateRepo.findAll();
    return { status: 200, body: { items: templates.map((t) => t.toJSON()), count: templates.length } };
  }
}
