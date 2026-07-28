import { NotificationTemplateAggregate, NotificationChannel, NotificationTemplateStatus } from '../entities/notification_template.entity.js';

export interface ListNotificationTemplatesOptions {
  page?: number;
  limit?: number;
  channel?: NotificationChannel;
  status?: NotificationTemplateStatus;
  code?: string;
  sortBy?: 'createdAt' | 'code' | 'name';
  sortOrder?: 'ASC' | 'DESC';
}

export interface NotificationTemplateRepository {
  save(template: NotificationTemplateAggregate, tenantId: string): Promise<NotificationTemplateAggregate>;
  findById(id: string, tenantId: string): Promise<NotificationTemplateAggregate | null>;
  findByCode(code: string, tenantId: string): Promise<NotificationTemplateAggregate | null>;
  list(tenantId: string, options?: ListNotificationTemplatesOptions): Promise<{ items: NotificationTemplateAggregate[]; total: number }>;
  update(template: NotificationTemplateAggregate, tenantId: string): Promise<NotificationTemplateAggregate>;
  delete(id: string, tenantId: string): Promise<boolean>;
}
