import { NotificationTemplateRepository } from '../../domain/repositories/notification_template.repository.js';
import { CreateNotificationTemplateInputDTO } from '../dtos/notification_template.dto.js';
import { NotificationTemplateAggregate, NotificationTemplateDomainError } from '../../domain/entities/notification_template.entity.js';
import { validateCreateNotificationTemplateInput } from '../../domain/validation/notification_template.validation.js';
import { NotificationTemplateAuditService } from '../../infrastructure/audit/notification_template.audit.js';

export interface Principal {
  userId: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
}

export class CreateNotificationTemplateUseCase {
  constructor(private readonly repository: NotificationTemplateRepository) {}

  async execute(principal: Principal, dto: CreateNotificationTemplateInputDTO, idempotencyKey?: string): Promise<NotificationTemplateAggregate> {
    if (!principal || !principal.tenantId) {
      throw new NotificationTemplateDomainError('Unauthorized: Principal tenant context is required');
    }

    const hasPermission = principal.permissions?.includes('notification:template:create') ||
                          principal.permissions?.includes('notification:*') ||
                          principal.roles?.includes('admin');
    if (!hasPermission) {
      throw new NotificationTemplateDomainError('Forbidden: Insufficient permissions to create notification template');
    }

    const validated = validateCreateNotificationTemplateInput({ ...dto, idempotencyKey: idempotencyKey || dto.idempotencyKey });

    // Check code uniqueness within tenant
    const existing = await this.repository.findByCode(validated.code, principal.tenantId);
    if (existing) {
      if (idempotencyKey && existing.idempotencyKey === idempotencyKey) {
        return existing;
      }
      throw new NotificationTemplateDomainError(`Conflict: Notification template with code '${validated.code}' already exists`);
    }

    const template = new NotificationTemplateAggregate({
      tenantId: principal.tenantId,
      code: validated.code,
      name: validated.name,
      channel: validated.channel,
      subject: validated.subject,
      bodyTemplate: validated.bodyTemplate,
      status: validated.status,
      idempotencyKey: idempotencyKey || validated.idempotencyKey,
    });

    const saved = await this.repository.save(template, principal.tenantId);

    NotificationTemplateAuditService.record({
      action: 'TEMPLATE_CREATED',
      templateId: saved.id,
      tenantId: principal.tenantId,
      actorUserId: principal.userId,
      changes: {
        code: { old: null, new: saved.code },
        channel: { old: null, new: saved.channel },
      },
    });

    return saved;
  }
}
