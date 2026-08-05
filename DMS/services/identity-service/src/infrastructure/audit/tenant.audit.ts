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

export class TenantAuditService {
  private logger = new StructuredLogger('TenantAuditService');
  private static auditLogs: AuditLogEntry[] = [];

  async recordMutation(entry: AuditLogEntry): Promise<void> {
    const record: AuditLogEntry = {
      ...entry,
      timestamp: entry.timestamp || new Date(),
    };
    TenantAuditService.auditLogs.push(record);
    this.logger.info(`Tenant Audit log recorded: [${record.action}] for Tenant:${record.entityId} by ${record.actorId}`);
  }

  static getAuditLogs(): AuditLogEntry[] {
    return [...TenantAuditService.auditLogs];
  }

  static clearAuditLogs(): void {
    TenantAuditService.auditLogs = [];
  }
}
