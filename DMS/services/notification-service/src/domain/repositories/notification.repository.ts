import { NotificationAggregate, NotificationChannel, NotificationStatus } from '../entities/notification.entity.js';

export interface NotificationFilter {
  tenantId: string;
  recipient?: string;
  channel?: NotificationChannel;
  status?: NotificationStatus;
  templateId?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'recipient';
  sortOrder?: 'asc' | 'desc';
}

export interface NotificationRepository {
  save(notification: NotificationAggregate): Promise<NotificationAggregate>;
  findById(id: string, tenantId: string): Promise<NotificationAggregate | null>;
  findAll(filter: NotificationFilter): Promise<{ notifications: NotificationAggregate[]; total: number; page: number; pageSize: number }>;
  delete(id: string, tenantId: string): Promise<boolean>;
}
