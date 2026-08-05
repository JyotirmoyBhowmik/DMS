import { NotificationChannel, NotificationStatus } from '../../domain/entities/notification.entity.js';

export interface CreateNotificationDto {
  id?: string;
  templateId?: string;
  recipient: string;
  channel: NotificationChannel;
  payload?: Record<string, any>;
  idempotencyKey?: string;
}

export interface UpdateNotificationDto {
  payload?: Record<string, any>;
  version: number;
}

export interface TransitionNotificationStatusDto {
  status: 'PROCESSING' | 'SENT' | 'FAILED' | 'CANCELLED';
  errorMessage?: string;
  expectedVersion?: number;
}

export interface NotificationResponseDto {
  id: string;
  tenantId: string;
  templateId?: string | null;
  recipient: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  payload: Record<string, any>;
  errorMessage?: string | null;
  sentAt?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ListNotificationsQueryDto {
  recipient?: string;
  channel?: NotificationChannel;
  status?: NotificationStatus;
  templateId?: string;
  page?: number;
  pageSize?: number;
}
