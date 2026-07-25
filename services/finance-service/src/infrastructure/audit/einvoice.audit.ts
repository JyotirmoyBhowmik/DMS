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

export class EInvoiceAuditService {
  private logger = new StructuredLogger('EInvoiceAuditService');
  private static auditLogs: AuditLogEntry[] = [];

  async recordMutation(entry: AuditLogEntry): Promise<void> {
    const record: AuditLogEntry = {
      ...entry,
      timestamp: entry.timestamp || new Date(),
    };
    EInvoiceAuditService.auditLogs.push(record);
    this.logger.info(`eInvoice Audit log recorded: [${record.action}] for eInvoice:${record.entityId} by ${record.actorId}`);
  }

  static getAuditLogs(): AuditLogEntry[] {
    return [...EInvoiceAuditService.auditLogs];
  }

  static clearAuditLogs(): void {
    EInvoiceAuditService.auditLogs = [];
  }
}
