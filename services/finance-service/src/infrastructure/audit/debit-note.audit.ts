import { StructuredLogger } from '@dms/pkg-logger';
import { AuditRecord } from './invoice.audit.js';

export class DebitNoteAuditService {
  private logger = new StructuredLogger('DebitNoteAuditService');
  private static auditTrail: AuditRecord[] = [];

  public static clearAuditTrail(): void {
    DebitNoteAuditService.auditTrail = [];
  }

  public static getAuditTrail(tenantId: string): AuditRecord[] {
    return DebitNoteAuditService.auditTrail.filter(r => r.tenantId === tenantId);
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
      id: `audit-dn-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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

    DebitNoteAuditService.auditTrail.push(entry);
    this.logger.info(`DebitNote Audit log recorded: [${entry.action}] for ${entry.entityType}:${entry.entityId} by ${entry.actorId}`);
    return entry;
  }
}
