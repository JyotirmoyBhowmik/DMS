import { NotificationChannel, NotificationTemplateStatus } from '../../domain/entities/notification_template.entity.js';

export interface CreateNotificationTemplateInputDTO {
  code: string;
  name: string;
  channel: NotificationChannel;
  subject?: string | null;
  bodyTemplate: string;
  status?: NotificationTemplateStatus;
  idempotencyKey?: string;
}

export interface UpdateNotificationTemplateInputDTO {
  name?: string;
  subject?: string | null;
  bodyTemplate?: string;
  status?: NotificationTemplateStatus;
  version: number;
}

export interface NotificationTemplateResponseDTO {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  channel: NotificationChannel;
  subject: string | null;
  bodyTemplate: string;
  status: NotificationTemplateStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}
