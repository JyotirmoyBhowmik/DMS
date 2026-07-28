import { NotificationAggregate } from '../../domain/entities/notification.entity.js';
import { NotificationRepository } from '../../domain/repositories/notification.repository.js';
import { ListNotificationsQueryDto, NotificationResponseDto } from '../dtos/notification.dto.js';
import { Principal } from './create-notification.usecase.js';

export interface PaginatedNotificationsResponseDto {
  notifications: NotificationResponseDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class ListNotificationsUseCase {
  constructor(private readonly repository: NotificationRepository) {}

  public async execute(principal: Principal, query: ListNotificationsQueryDto): Promise<PaginatedNotificationsResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('notification:read') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to list notifications.');
    }

    const result = await this.repository.findAll({
      tenantId: principal.tenantId,
      recipient: query.recipient,
      channel: query.channel,
      status: query.status,
      templateId: query.templateId,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20
    });

    return {
      notifications: result.notifications.map(n => this.mapToResponse(n)),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    };
  }

  private mapToResponse(notification: NotificationAggregate): NotificationResponseDto {
    return {
      id: notification.id,
      tenantId: notification.tenantId,
      templateId: notification.templateId,
      recipient: notification.recipient,
      channel: notification.channel,
      status: notification.status,
      payload: notification.payload,
      errorMessage: notification.errorMessage,
      sentAt: notification.sentAt ? notification.sentAt.toISOString() : null,
      version: notification.version,
      createdAt: notification.createdAt.toISOString(),
      updatedAt: notification.updatedAt.toISOString()
    };
  }
}
