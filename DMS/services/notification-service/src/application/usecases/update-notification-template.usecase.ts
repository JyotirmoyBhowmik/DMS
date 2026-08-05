import { NotificationTemplateRepository } from '../../domain/repositories/notification_template.repository.js';
import { UpdateNotificationTemplateInputDTO } from '../dtos/notification_template.dto.js';
import { NotificationTemplateAggregate, NotificationTemplateDomainError } from '../../domain/entities/notification_template.entity.js';
import { validateUpdateNotificationTemplateInput } from '../../domain/validation/notification_template.validation.js';
import { NotificationTemplateAuditService } from '../../infrastructure/audit/notification_template.audit.js';
import { Principal } from './create-notification-template.usecase.js';

export class UpdateNotificationTemplateUseCase {
  constructor(private readonly repository: NotificationTemplateRepository) {}

  async execute(id: string, principal: Principal, dto: UpdateNotificationTemplateInputDTO): Promise<NotificationTemplateAggregate> {
    if (!principal || !principal.tenantId) {
      throw new NotificationTemplateDomainError('Unauthorized: Principal tenant context is required');
    }

    const hasPermission = principal.permissions?.includes('notification:template:update') ||
                          principal.permissions?.includes('notification:*') ||
                          principal.roles?.includes('admin');
    if (!hasPermission) {
      throw new NotificationTemplateDomainError('Forbidden: Insufficient permissions to update notification template');
    }

    const validated = validateUpdateNotificationTemplateInput(dto);

    const existing = await this.repository.findById(id, principal.tenantId);
    if (!existing) {
      throw new NotificationTemplateDomainError(`NotificationTemplate with id '${id}' not found`);
    }

    if (existing.version !== validated.version) {
      throw new NotificationTemplateDomainError(
        `Optimistic concurrency conflict for NotificationTemplate '${id}': expected v${validated.version}, found v${existing.version}`
      );
    }

    const changes: Record<string, { old: any; new: any }> = {};

    if (validated.name || validated.subject !== undefined || validated.bodyTemplate) {
      changes.content = { old: { name: existing.name, subject: existing.subject, bodyTemplate: existing.bodyTemplate }, new: { name: validated.name || existing.name, subject: validated.subject, bodyTemplate: validated.bodyTemplate || existing.bodyTemplate } };
      existing.updateContent(validated.name, validated.subject, validated.bodyTemplate);
    }

    if (validated.status && validated.status !== existing.status) {
      changes.status = { old: existing.status, new: validated.status };
      if (validated.status === 'ACTIVE') existing.activate();
      else if (validated.status === 'INACTIVE') existing.deactivate();
      else if (validated.status === 'ARCHIVED') existing.archive();
    }

    const updated = await this.repository.update(existing, principal.tenantId);

    NotificationTemplateAuditService.record({
      action: 'TEMPLATE_UPDATED',
      templateId: updated.id,
      tenantId: principal.tenantId,
      actorUserId: principal.userId,
      changes,
    });

    return updated;
  }
}
