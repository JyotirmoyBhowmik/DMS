export interface AuditLogEntry {
  id: string;
  tenantId: string;
  action: string;
  entityId: string;
  userId: string;
  timestamp: string;
  details: Record<string, any>;
}

export class NotificationAuditService {
  private static logs: AuditLogEntry[] = [];

  public static async logAction(
    tenantId: string,
    action: string,
    entityId: string,
    userId: string,
    details: Record<string, any> = {}
  ): Promise<void> {
    const entry: AuditLogEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      tenantId,
      action,
      entityId,
      userId,
      timestamp: new Date().toISOString(),
      details
    };
    NotificationAuditService.logs.push(entry);
  }

  public static getAuditLogs(): AuditLogEntry[] {
    return [...NotificationAuditService.logs];
  }

  public static clearAuditLogs(): void {
    NotificationAuditService.logs = [];
  }
}
