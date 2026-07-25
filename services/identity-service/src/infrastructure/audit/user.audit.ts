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

export class UserAuditService {
  private logger = new StructuredLogger('UserAuditService');
  private static auditLogs: AuditLogEntry[] = [];

  async recordMutation(entry: AuditLogEntry): Promise<void> {
    const record: AuditLogEntry = {
      ...entry,
      timestamp: entry.timestamp || new Date(),
    };
    UserAuditService.auditLogs.push(record);
    this.logger.info(`User Audit log recorded: [${record.action}] for User:${record.entityId} by ${record.actorId}`);
  }

  static getAuditLogs(): AuditLogEntry[] {
    return [...UserAuditService.auditLogs];
  }

  static clearAuditLogs(): void {
    UserAuditService.auditLogs = [];
  }
}
