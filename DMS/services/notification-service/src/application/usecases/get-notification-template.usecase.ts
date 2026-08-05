import { NotificationTemplateRepository } from '../../domain/repositories/notification_template.repository.js';
import { NotificationTemplateAggregate, NotificationTemplateDomainError } from '../../domain/entities/notification_template.entity.js';
import { Principal } from './create-notification-template.usecase.js';

export class GetNotificationTemplateUseCase {
  constructor(private readonly repository: NotificationTemplateRepository) {}

  async execute(id: string, principal: Principal): Promise<NotificationTemplateAggregate> {
    if (!principal || !principal.tenantId) {
      throw new NotificationTemplateDomainError('Unauthorized: Principal tenant context is required');
    }

    const hasPermission = principal.permissions?.includes('notification:template:read') ||
                          principal.permissions?.includes('notification:*') ||
                          principal.roles?.includes('admin');
    if (!hasPermission) {
      throw new NotificationTemplateDomainError('Forbidden: Insufficient permissions to view notification template');
    }

    const template = await this.repository.findById(id, principal.tenantId);
    if (!template) {
      throw new NotificationTemplateDomainError(`NotificationTemplate with id '${id}' not found`);
    }

    return template;
  }
}
