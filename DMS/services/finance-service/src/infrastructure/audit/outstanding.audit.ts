export interface OutstandingAuditRecord {
  id: string;
  tenantId: string;
  actorId: string;
  action: string;
  entityType: 'Outstanding';
  entityId: string;
  correlationId: string;
  source: 'API' | 'WEB_ADMIN' | 'MOBILE' | 'SYSTEM';
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  timestamp: Date;
}

export class OutstandingAuditService {
  private static auditTrail: OutstandingAuditRecord[] = [];

  public static clearAuditTrail(): void {
    OutstandingAuditService.auditTrail = [];
  }

  public static getAuditTrail(tenantId?: string): OutstandingAuditRecord[] {
    if (!tenantId) return [...OutstandingAuditService.auditTrail];
    return OutstandingAuditService.auditTrail.filter(r => r.tenantId === tenantId);
  }

  public async recordMutation(params: {
    tenantId: string;
    actorId: string;
    action: string;
    entityType: 'Outstanding';
    entityId: string;
    correlationId: string;
    source: 'API' | 'WEB_ADMIN' | 'MOBILE' | 'SYSTEM';
    oldValue?: Record<string, any>;
    newValue?: Record<string, any>;
  }): Promise<OutstandingAuditRecord> {
    const record: OutstandingAuditRecord = {
      id: `aud-out-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      tenantId: params.tenantId,
      actorId: params.actorId,
      action: params.action,
      entityType: 'Outstanding',
      entityId: params.entityId,
      correlationId: params.correlationId,
      source: params.source,
      oldValue: params.oldValue ? this.redactSecrets(params.oldValue) : undefined,
      newValue: params.newValue ? this.redactSecrets(params.newValue) : undefined,
      timestamp: new Date(),
    };

    OutstandingAuditService.auditTrail.push(record);
    console.log(JSON.stringify({
      timestamp: record.timestamp.toISOString(),
      level: 'INFO',
      message: `Outstanding Audit log recorded: [${record.action}] for Outstanding:${record.entityId} by ${record.actorId}`,
      service: 'OutstandingAuditService',
    }));

    return record;
  }

  private redactSecrets(obj: Record<string, any>): Record<string, any> {
    const redacted = { ...obj };
    const secretKeys = ['password', 'token', 'secret', 'ssn', 'creditCard'];
    for (const key of Object.keys(redacted)) {
      if (secretKeys.some(sk => key.toLowerCase().includes(sk))) {
        redacted[key] = '[REDACTED]';
      }
    }
    return redacted;
  }
}
