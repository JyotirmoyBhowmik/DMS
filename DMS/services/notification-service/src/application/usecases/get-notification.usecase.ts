import { NotificationAggregate } from '../../domain/entities/notification.entity.js';
import { NotificationRepository } from '../../domain/repositories/notification.repository.js';
import { NotificationResponseDto } from '../dtos/notification.dto.js';
import { Principal } from './create-notification.usecase.js';

export class GetNotificationUseCase {
  constructor(private readonly repository: NotificationRepository) {}

  public async execute(principal: Principal, id: string): Promise<NotificationResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('notification:read') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to view notification.');
    }
    if (!id || id.trim().length === 0) {
      throw new Error('Notification ID is required.');
    }

    const notification = await this.repository.findById(id, principal.tenantId);
    if (!notification) {
      throw new Error(`Notification with ID '${id}' not found.`);
    }

    return this.mapToResponse(notification);
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
