import { StructuredLogger } from '@dms/pkg-logger';

export interface RecommendationAuditRecord {
  timestamp: string;
  tenantId: string;
  actorId: string;
  action: string;
  entityId: string;
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
}

export class RecommendationAuditService {
  private logger = new StructuredLogger('RecommendationAuditService');
  private static auditLogs: RecommendationAuditRecord[] = [];

  public async recordMutation(params: {
    tenantId: string;
    actorId: string;
    action: string;
    entityId: string;
    oldValue?: Record<string, any>;
    newValue?: Record<string, any>;
  }): Promise<void> {
    const record: RecommendationAuditRecord = {
      timestamp: new Date().toISOString(),
      tenantId: this.maskTenantId(params.tenantId),
      actorId: params.actorId,
      action: params.action,
      entityId: params.entityId,
      oldValue: params.oldValue ? this.redactSecrets(params.oldValue) : undefined,
      newValue: params.newValue ? this.redactSecrets(params.newValue) : undefined
    };

    RecommendationAuditService.auditLogs.push(record);
    this.logger.info(`Audit entry recorded: ${params.action}`, {
      tenantId: record.tenantId,
      actorId: record.actorId,
      action: record.action,
      entityId: record.entityId
    });
  }

  private maskTenantId(tenantId: string): string {
    if (!tenantId || tenantId.length < 8) return '[REDACTED]';
    return `${tenantId.substring(0, 4)}-****-${tenantId.substring(tenantId.length - 4)}`;
  }

  private redactSecrets(obj: Record<string, any>): Record<string, any> {
    const redacted = { ...obj };
    const secretKeys = ['password', 'secret', 'token', 'apikey', 'privatekey'];

    for (const key of Object.keys(redacted)) {
      if (secretKeys.some(s => key.toLowerCase().includes(s))) {
        redacted[key] = '[REDACTED]';
      }
    }
    return redacted;
  }

  public static getAuditLogs(): RecommendationAuditRecord[] {
    return [...RecommendationAuditService.auditLogs];
  }

  public static clearAuditLogs(): void {
    RecommendationAuditService.auditLogs = [];
  }
}
