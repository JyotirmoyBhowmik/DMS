import { StructuredLogger } from '@dms/pkg-logger';

export interface ConfigAuditRecord {
  timestamp: string;
  tenantId: string;
  actorId: string;
  action: string;
  entityId: string;
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
}

export class ConfigAuditService {
  private logger = new StructuredLogger('ConfigAuditService');
  private static auditLogs: ConfigAuditRecord[] = [];

  public async recordMutation(params: {
    tenantId: string;
    actorId: string;
    action: string;
    entityId: string;
    oldValue?: Record<string, any>;
    newValue?: Record<string, any>;
  }): Promise<void> {
    const record: ConfigAuditRecord = {
      timestamp: new Date().toISOString(),
      tenantId: this.maskTenantId(params.tenantId),
      actorId: params.actorId,
      action: params.action,
      entityId: params.entityId,
      oldValue: params.oldValue ? this.redactSecrets(params.oldValue) : undefined,
      newValue: params.newValue ? this.redactSecrets(params.newValue) : undefined
    };

    ConfigAuditService.auditLogs.push(record);
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
    const secretKeys = ['password', 'secret', 'token', 'apikey', 'privatekey', 'ssn', 'configValue'];

    for (const key of Object.keys(redacted)) {
      if (secretKeys.some(s => key.toLowerCase().includes(s))) {
        redacted[key] = '[REDACTED]';
      }
    }
    return redacted;
  }

  public static getAuditLogs(): ConfigAuditRecord[] {
    return [...ConfigAuditService.auditLogs];
  }

  public static clearAuditLogs(): void {
    ConfigAuditService.auditLogs = [];
  }
}
