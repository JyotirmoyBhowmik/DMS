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

export class AgeingReportAuditService {
  private logger = new StructuredLogger('AgeingReportAuditService');
  private static auditLogs: AuditLogEntry[] = [];

  async recordMutation(entry: AuditLogEntry): Promise<void> {
    const record: AuditLogEntry = {
      ...entry,
      timestamp: entry.timestamp || new Date(),
    };
    AgeingReportAuditService.auditLogs.push(record);
    this.logger.info(`AgeingReport Audit log recorded: [${record.action}] for AgeingReport:${record.entityId} by ${record.actorId}`);
  }

  static getAuditLogs(): AuditLogEntry[] {
    return [...AgeingReportAuditService.auditLogs];
  }

  static clearAuditLogs(): void {
    AgeingReportAuditService.auditLogs = [];
  }
}
