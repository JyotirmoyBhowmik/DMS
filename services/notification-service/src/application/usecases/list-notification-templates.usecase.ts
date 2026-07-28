import { NotificationTemplateRepository, ListNotificationTemplatesOptions } from '../../domain/repositories/notification_template.repository.js';
import { NotificationTemplateAggregate, NotificationTemplateDomainError } from '../../domain/entities/notification_template.entity.js';
import { Principal } from './create-notification-template.usecase.js';

export class ListNotificationTemplatesUseCase {
  constructor(private readonly repository: NotificationTemplateRepository) {}

  async execute(principal: Principal, options?: ListNotificationTemplatesOptions): Promise<{ items: NotificationTemplateAggregate[]; total: number }> {
    if (!principal || !principal.tenantId) {
      throw new NotificationTemplateDomainError('Unauthorized: Principal tenant context is required');
    }

    const hasPermission = principal.permissions?.includes('notification:template:read') ||
                          principal.permissions?.includes('notification:*') ||
                          principal.roles?.includes('admin');
    if (!hasPermission) {
      throw new NotificationTemplateDomainError('Forbidden: Insufficient permissions to list notification templates');
    }

    const page = Math.max(1, options?.page || 1);
    const limit = Math.min(100, Math.max(1, options?.limit || 20));

    return this.repository.list(principal.tenantId, {
      ...options,
      page,
      limit,
    });
  }
}
