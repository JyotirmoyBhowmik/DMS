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

export class EWayBillAuditService {
  private logger = new StructuredLogger('EWayBillAuditService');
  private static auditLogs: AuditLogEntry[] = [];

  async recordMutation(entry: AuditLogEntry): Promise<void> {
    const record: AuditLogEntry = {
      ...entry,
      timestamp: entry.timestamp || new Date(),
    };
    EWayBillAuditService.auditLogs.push(record);
    this.logger.info(`eWayBill Audit log recorded: [${record.action}] for eWayBill:${record.entityId} by ${record.actorId}`);
  }

  static getAuditLogs(): AuditLogEntry[] {
    return [...EWayBillAuditService.auditLogs];
  }

  static clearAuditLogs(): void {
    EWayBillAuditService.auditLogs = [];
  }
}
