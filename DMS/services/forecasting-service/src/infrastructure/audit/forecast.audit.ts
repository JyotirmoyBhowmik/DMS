import { StructuredLogger } from '@dms/pkg-logger';

export interface ForecastAuditRecord {
  timestamp: string;
  tenantId: string;
  actorId: string;
  action: string;
  entityId: string;
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
}

export class ForecastAuditService {
  private logger = new StructuredLogger('ForecastAuditService');
  private static auditLogs: ForecastAuditRecord[] = [];

  public async recordMutation(params: {
    tenantId: string;
    actorId: string;
    action: string;
    entityId: string;
    oldValue?: Record<string, any>;
    newValue?: Record<string, any>;
  }): Promise<void> {
    const record: ForecastAuditRecord = {
      timestamp: new Date().toISOString(),
      tenantId: this.maskTenantId(params.tenantId),
      actorId: params.actorId,
      action: params.action,
      entityId: params.entityId,
      oldValue: params.oldValue ? this.redactSecrets(params.oldValue) : undefined,
      newValue: params.newValue ? this.redactSecrets(params.newValue) : undefined
    };

    ForecastAuditService.auditLogs.push(record);
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

  public static getAuditLogs(): ForecastAuditRecord[] {
    return [...ForecastAuditService.auditLogs];
  }

  public static clearAuditLogs(): void {
    ForecastAuditService.auditLogs = [];
  }
}
