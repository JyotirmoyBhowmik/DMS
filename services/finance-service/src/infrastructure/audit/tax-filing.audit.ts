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

export class TaxFilingAuditService {
  private logger = new StructuredLogger('TaxFilingAuditService');
  private static auditLogs: AuditLogEntry[] = [];

  async recordMutation(entry: AuditLogEntry): Promise<void> {
    const record: AuditLogEntry = {
      ...entry,
      timestamp: entry.timestamp || new Date(),
    };
    TaxFilingAuditService.auditLogs.push(record);
    this.logger.info(`TaxFiling Audit log recorded: [${record.action}] for TaxFiling:${record.entityId} by ${record.actorId}`);
  }

  static getAuditLogs(): AuditLogEntry[] {
    return [...TaxFilingAuditService.auditLogs];
  }

  static clearAuditLogs(): void {
    TaxFilingAuditService.auditLogs = [];
  }
}
