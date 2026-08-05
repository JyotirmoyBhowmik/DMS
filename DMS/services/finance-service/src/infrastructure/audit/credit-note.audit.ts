import { StructuredLogger } from '@dms/pkg-logger';
import { AuditRecord } from './invoice.audit.js';

export class CreditNoteAuditService {
  private logger = new StructuredLogger('CreditNoteAuditService');
  private static auditTrail: AuditRecord[] = [];

  public static clearAuditTrail(): void {
    CreditNoteAuditService.auditTrail = [];
  }

  public static getAuditTrail(tenantId: string): AuditRecord[] {
    return CreditNoteAuditService.auditTrail.filter(r => r.tenantId === tenantId);
  }

  async recordMutation(record: Omit<AuditRecord, 'id' | 'timestamp'>): Promise<AuditRecord> {
    const sanitizeObj = (obj?: Record<string, any>) => {
      if (!obj) return undefined;
      const copy = { ...obj };
      delete copy.password;
      delete copy.secret;
      delete copy.token;
      return copy;
    };

    const entry: AuditRecord = {
      id: `audit-cn-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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

    CreditNoteAuditService.auditTrail.push(entry);
    this.logger.info(`CreditNote Audit log recorded: [${entry.action}] for ${entry.entityType}:${entry.entityId} by ${entry.actorId}`);
    return entry;
  }
}
