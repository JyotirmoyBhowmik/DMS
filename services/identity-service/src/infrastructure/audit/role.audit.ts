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

export class RoleAuditService {
  private logger = new StructuredLogger('RoleAuditService');
  private static auditLogs: AuditLogEntry[] = [];

  async recordMutation(entry: AuditLogEntry): Promise<void> {
    const record: AuditLogEntry = {
      ...entry,
      timestamp: entry.timestamp || new Date(),
    };
    RoleAuditService.auditLogs.push(record);
    this.logger.info(`Role Audit log recorded: [${record.action}] for Role:${record.entityId} by ${record.actorId}`);
  }

  static getAuditLogs(): AuditLogEntry[] {
    return [...RoleAuditService.auditLogs];
  }

  static clearAuditLogs(): void {
    RoleAuditService.auditLogs = [];
  }
}
