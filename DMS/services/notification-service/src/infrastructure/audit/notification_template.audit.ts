import { StructuredLogger } from '@dms/pkg-logger';

export interface NotificationTemplateAuditLogEntry {
  action: 'TEMPLATE_CREATED' | 'TEMPLATE_UPDATED' | 'TEMPLATE_ACTIVATED' | 'TEMPLATE_DEACTIVATED' | 'TEMPLATE_ARCHIVED' | 'TEMPLATE_DELETED';
  templateId: string;
  tenantId: string;
  actorUserId: string;
  timestamp: string;
  changes?: Record<string, { old: any; new: any }>;
}

export class NotificationTemplateAuditService {
  private static logger = new StructuredLogger('NotificationTemplateAuditService');
  private static auditLogs: NotificationTemplateAuditLogEntry[] = [];

  static record(entry: Omit<NotificationTemplateAuditLogEntry, 'timestamp'>): void {
    const fullEntry: NotificationTemplateAuditLogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };

    NotificationTemplateAuditService.auditLogs.push(fullEntry);
    NotificationTemplateAuditService.logger.info(`NotificationTemplate Audit log recorded: [${fullEntry.action}] for Template:${fullEntry.templateId} by ${fullEntry.actorUserId}`);
  }

  static getAuditLogs(): NotificationTemplateAuditLogEntry[] {
    return [...NotificationTemplateAuditService.auditLogs];
  }

  static clearAuditLogs(): void {
    NotificationTemplateAuditService.auditLogs = [];
  }
}
