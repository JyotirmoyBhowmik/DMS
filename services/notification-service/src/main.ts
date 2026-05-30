import { NotificationController } from './presentation/rest/controllers/notification.controller.js';

const controller = new NotificationController();

async function bootstrap(): Promise<void> {
  process.stdout.write('\n=== NOTIFICATION-SERVICE BOOTSTRAP ===\n');

  const templates = await controller.handleListTemplates();
  process.stdout.write(`\n📋 Templates: ${(templates.body as Record<string, unknown>).count} loaded\n`);

  const result = await controller.handleSendNotification({
    tenantId: 'tenant-uuid-1111',
    recipientId: 'user-uuid-3333',
    templateId: 'tpl-order-confirmation',
    channel: 'email',
    data: {
      orderId: 'ORD-2024-001',
      customerName: 'Rajesh Kumar',
      amount: '₹15,000',
      deliveryDate: '2024-03-15',
    },
  });

  process.stdout.write(`\n📨 Send Result (status=${result.status}):\n${JSON.stringify(result.body, null, 2)}\n`);

  const push = await controller.handleSendNotification({
    tenantId: 'tenant-uuid-1111',
    recipientId: 'agent-uuid-4444',
    templateId: 'tpl-visit-reminder',
    channel: 'push',
    data: { outletName: 'ABC Retail Store', time: '10:00 AM' },
  });

  process.stdout.write(`\n🔔 Push Result (status=${push.status})\n`);
  process.stdout.write('\n=== NOTIFICATION-SERVICE BOOTSTRAP COMPLETE ===\n');
}

bootstrap();
