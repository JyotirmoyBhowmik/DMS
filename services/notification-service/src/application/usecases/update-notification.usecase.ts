import { NotificationAggregate } from '../../domain/entities/notification.entity.js';
import { NotificationRepository } from '../../domain/repositories/notification.repository.js';
import { validateUpdateNotificationInput } from '../../domain/validation/notification.validation.js';
import { NotificationResponseDto, TransitionNotificationStatusDto, UpdateNotificationDto } from '../dtos/notification.dto.js';
import { NotificationAuditService } from '../../infrastructure/audit/notification.audit.js';
import { Principal } from './create-notification.usecase.js';

export class UpdateNotificationUseCase {
  constructor(private readonly repository: NotificationRepository) {}

  public async updatePayload(principal: Principal, id: string, dto: UpdateNotificationDto): Promise<NotificationResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('notification:update') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to update notification.');
    }

    validateUpdateNotificationInput(dto);

    const notification = await this.repository.findById(id, principal.tenantId);
    if (!notification) {
      throw new Error(`Notification with ID '${id}' not found.`);
    }

    if (dto.payload) {
      notification.updatePayload(dto.payload, dto.version);
    }

    await this.repository.save(notification);

    await NotificationAuditService.logAction(
      principal.tenantId,
      'NOTIFICATION_UPDATED',
      notification.id,
      principal.userId,
      { version: notification.version }
    );

    return this.mapToResponse(notification);
  }

  public async transitionStatus(principal: Principal, id: string, dto: TransitionNotificationStatusDto): Promise<NotificationResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('notification:update') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to transition notification status.');
    }

    const notification = await this.repository.findById(id, principal.tenantId);
    if (!notification) {
      throw new Error(`Notification with ID '${id}' not found.`);
    }

    if (dto.expectedVersion !== undefined && notification.version !== dto.expectedVersion) {
      throw new Error(`Optimistic locking failure: expected version ${dto.expectedVersion}, but found ${notification.version}.`);
    }

    switch (dto.status) {
      case 'PROCESSING':
        notification.startProcessing();
        break;
      case 'SENT':
        notification.markAsSent();
        break;
      case 'FAILED':
        if (!dto.errorMessage) {
          throw new Error('Error message is required when marking notification as FAILED.');
        }
        notification.markAsFailed(dto.errorMessage);
        break;
      case 'CANCELLED':
        notification.cancel();
        break;
      default:
        throw new Error(`Unsupported status transition: ${dto.status}`);
    }

    await this.repository.save(notification);

    await NotificationAuditService.logAction(
      principal.tenantId,
      `NOTIFICATION_STATUS_${dto.status}`,
      notification.id,
      principal.userId,
      { status: notification.status }
    );

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
