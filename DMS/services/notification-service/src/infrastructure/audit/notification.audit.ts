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
      details: this.sanitizeDetails(details)
    };
    NotificationAuditService.logs.push(entry);
  }

  private static sanitizeDetails(details: Record<string, any>): Record<string, any> {
    const sensitiveKeys = ['password', 'secret', 'token', 'ssn', 'creditCard', 'authHeader'];
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(details)) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
        sanitized[key] = '***REDACTED***';
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeDetails(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  public static getAuditLogs(): AuditLogEntry[] {
    return [...NotificationAuditService.logs];
  }

  public static clearAuditLogs(): void {
    NotificationAuditService.logs = [];
  }
}
