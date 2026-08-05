import { NotificationPgRepository } from './infrastructure/database/repositories/notification.pg-repository.js';
import { CreateNotificationUseCase } from './application/usecases/create-notification.usecase.js';
import { GetNotificationUseCase } from './application/usecases/get-notification.usecase.js';
import { UpdateNotificationUseCase } from './application/usecases/update-notification.usecase.js';
import { ListNotificationsUseCase } from './application/usecases/list-notifications.usecase.js';
import { NotificationController } from './presentation/rest/controllers/notification.controller.js';

const repo = new NotificationPgRepository();
const createUseCase = new CreateNotificationUseCase(repo);
const getUseCase = new GetNotificationUseCase(repo);
const updateUseCase = new UpdateNotificationUseCase(repo);
const listUseCase = new ListNotificationsUseCase(repo);

const controller = new NotificationController(createUseCase, getUseCase, updateUseCase, listUseCase);

async function bootstrap(): Promise<void> {
  process.stdout.write('\n=== NOTIFICATION-SERVICE BOOTSTRAP ===\n');

  const req = {
    headers: {
      'content-type': 'application/json',
      'x-tenant-id': '00000000-0000-0000-0000-000000000001',
      'x-user-id': 'admin-1',
      'x-user-roles': 'admin',
      'x-user-permissions': 'notification:create,notification:read,notification:update'
    },
    body: {
      recipient: 'user@example.com',
      channel: 'EMAIL',
      payload: { welcome: true }
    }
  };

  const createRes = await controller.handleCreate(req);
  process.stdout.write(`\n📨 Create Notification Result (status=${createRes.statusCode}):\n${JSON.stringify(createRes.body, null, 2)}\n`);

  const listRes = await controller.handleList({ headers: req.headers, query: { page: 1, pageSize: 10 } });
  process.stdout.write(`\n📋 Notifications List (count=${listRes.body.total}):\n${JSON.stringify(listRes.body, null, 2)}\n`);

  process.stdout.write('\n=== NOTIFICATION-SERVICE BOOTSTRAP COMPLETE ===\n');
}

bootstrap();
