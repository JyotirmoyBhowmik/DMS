import { StructuredLogger } from '@dms/pkg-logger';

export interface MFADeviceAuditLogEntry {
  action:
    | 'MFA_DEVICE_CREATED'
    | 'MFA_DEVICE_UPDATED'
    | 'MFA_DEVICE_ACTIVATED'
    | 'MFA_DEVICE_DEACTIVATED'
    | 'MFA_DEVICE_DELETED';
  deviceId: string;
  tenantId: string;
  actorUserId: string;
  timestamp: string;
  changes?: Record<string, { old: any; new: any }>;
}

export class MFADeviceAuditService {
  private static logger = new StructuredLogger('MFADeviceAuditService');
  private static auditLogs: MFADeviceAuditLogEntry[] = [];

  static record(entry: Omit<MFADeviceAuditLogEntry, 'timestamp'>): void {
    const fullEntry: MFADeviceAuditLogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };

    MFADeviceAuditService.auditLogs.push(fullEntry);
    MFADeviceAuditService.logger.info(
      `MFADevice Audit log recorded: [${fullEntry.action}] for Device:${fullEntry.deviceId} by ${fullEntry.actorUserId}`,
    );
  }

  static getAuditLogs(): MFADeviceAuditLogEntry[] {
    return [...MFADeviceAuditService.auditLogs];
  }

  static clearAuditLogs(): void {
    MFADeviceAuditService.auditLogs = [];
  }
}
