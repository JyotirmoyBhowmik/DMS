import { StructuredLogger } from '@dms/pkg-logger';

export interface AuditLogEntry {
  tenantId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  correlationId: string;
  source: string;
  oldValue?: any;
  newValue?: any;
  timestamp?: Date;
}

export class PermissionAuditService {
  private logger = new StructuredLogger('PermissionAuditService');
  private static auditLogs: AuditLogEntry[] = [];

  async recordMutation(entry: AuditLogEntry): Promise<void> {
    const record: AuditLogEntry = {
      ...entry,
      timestamp: entry.timestamp || new Date(),
    };
    PermissionAuditService.auditLogs.push(record);
    this.logger.info(`Permission Audit log recorded: [${record.action}] for Permission:${record.entityId} by ${record.actorId}`);
  }

  static getAuditLogs(): AuditLogEntry[] {
    return [...PermissionAuditService.auditLogs];
  }

  static clearAuditLogs(): void {
    PermissionAuditService.auditLogs = [];
  }
}
