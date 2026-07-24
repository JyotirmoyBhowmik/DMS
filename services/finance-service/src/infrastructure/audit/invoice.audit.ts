import { StructuredLogger } from '@dms/pkg-logger';

export interface AuditRecord {
  id: string;
  tenantId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  correlationId?: string;
  source: string;
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  timestamp: string;
}

export class InvoiceAuditService {
  private logger = new StructuredLogger('InvoiceAuditService');
  private static auditTrail: AuditRecord[] = [];

  public static clearAuditTrail(): void {
    InvoiceAuditService.auditTrail = [];
  }

  public static getAuditTrail(tenantId: string): AuditRecord[] {
    return InvoiceAuditService.auditTrail.filter(r => r.tenantId === tenantId);
  }

  async recordMutation(record: Omit<AuditRecord, 'id' | 'timestamp'>): Promise<AuditRecord> {
    // Redact sensitive keys if any
    const sanitizeObj = (obj?: Record<string, any>) => {
      if (!obj) return undefined;
      const copy = { ...obj };
      delete copy.password;
      delete copy.secret;
      delete copy.token;
      return copy;
    };

    const entry: AuditRecord = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      tenantId: record.tenantId,
      actorId: record.actorId,
      action: record.action,
      entityType: record.entityType,
      entityId: record.entityId,
      correlationId: record.correlationId || 'N/A',
      source: record.source,
      oldValue: sanitizeObj(record.oldValue),
      newValue: sanitizeObj(record.newValue),
      timestamp: new Date().toISOString(),
    };

    InvoiceAuditService.auditTrail.push(entry);
    this.logger.info(`Audit log recorded: [${entry.action}] for ${entry.entityType}:${entry.entityId} by ${entry.actorId}`);
    return entry;
  }
}
