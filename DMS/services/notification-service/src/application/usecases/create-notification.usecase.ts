import { randomUUID } from 'node:crypto';
import { NotificationAggregate } from '../../domain/entities/notification.entity.js';
import { NotificationRepository } from '../../domain/repositories/notification.repository.js';
import { validateCreateNotificationInput } from '../../domain/validation/notification.validation.js';
import { CreateNotificationDto, NotificationResponseDto } from '../dtos/notification.dto.js';
import { NotificationAuditService } from '../../infrastructure/audit/notification.audit.js';

export interface Principal {
  userId: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
}

export class CreateNotificationUseCase {
  private static processedKeys: Set<string> = new Set<string>();

  constructor(private readonly repository: NotificationRepository) {}

  public async execute(principal: Principal, dto: CreateNotificationDto): Promise<NotificationResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('notification:create') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to create notification.');
    }

    validateCreateNotificationInput(dto);

    if (dto.idempotencyKey) {
      const key = `${principal.tenantId}:${dto.idempotencyKey}`;
      if (CreateNotificationUseCase.processedKeys.has(key)) {
        throw new Error(`Duplicate request: Idempotency key '${dto.idempotencyKey}' already processed.`);
      }
      CreateNotificationUseCase.processedKeys.add(key);
    }

    const notificationId = dto.id ?? randomUUID();
    const notification = NotificationAggregate.create({
      id: notificationId,
      tenantId: principal.tenantId,
      templateId: dto.templateId ?? null,
      recipient: dto.recipient,
      channel: dto.channel,
      payload: dto.payload ?? {}
    });

    await this.repository.save(notification);

    await NotificationAuditService.logAction(
      principal.tenantId,
      'NOTIFICATION_CREATED',
      notification.id,
      principal.userId,
      { recipient: notification.recipient, channel: notification.channel }
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
