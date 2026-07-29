import { StructuredLogger } from '@dms/pkg-logger';

export class ReportAuditService {
  private logger = new StructuredLogger('ReportAuditService');
  private static auditLogs: any[] = [];

  public static clearAuditLogs(): void {
    ReportAuditService.auditLogs = [];
  }

  public static getAuditLogs(): any[] {
    return [...ReportAuditService.auditLogs];
  }

  public async recordMutation(params: {
    tenantId: string;
    actorId: string;
    action: string;
    entityId: string;
    oldValue?: any;
    newValue?: any;
  }): Promise<void> {
    const entry = {
      timestamp: new Date().toISOString(),
      tenantId: params.tenantId,
      actorId: params.actorId,
      action: params.action,
      entityId: params.entityId,
      oldValue: params.oldValue,
      newValue: params.newValue
    };

    ReportAuditService.auditLogs.push(entry);
    this.logger.info(`Audit entry recorded: ${params.action}`, entry);
  }
}
