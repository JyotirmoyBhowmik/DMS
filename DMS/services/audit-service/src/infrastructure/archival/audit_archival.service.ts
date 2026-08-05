import { AuditLogAggregate } from '../../domain/entities/audit_log.entity.js';

export interface ColdStorageAdapter {
  uploadLogs(tenantId: string, partitionKey: string, logs: AuditLogAggregate[]): Promise<{ bucket: string; key: string; bytesUploaded: number }>;
}

export class InMemoryColdStorageAdapter implements ColdStorageAdapter {
  public uploadedFiles = new Map<string, AuditLogAggregate[]>();

  async uploadLogs(tenantId: string, partitionKey: string, logs: AuditLogAggregate[]): Promise<{ bucket: string; key: string; bytesUploaded: number }> {
    const key = `cold-storage/${tenantId}/${partitionKey}.json`;
    this.uploadedFiles.set(key, logs);
    return {
      bucket: 'dms-audit-archive-bucket',
      key,
      bytesUploaded: JSON.stringify(logs).length,
    };
  }
}

export class AuditArchivalService {
  private storageAdapter: ColdStorageAdapter;
  private retentionDays: number;

  constructor(storageAdapter?: ColdStorageAdapter, retentionDays: number = 365) {
    this.storageAdapter = storageAdapter ?? new InMemoryColdStorageAdapter();
    this.retentionDays = retentionDays;
  }

  async archiveAndPrune(tenantId: string, logs: AuditLogAggregate[], cutoffDate: Date): Promise<{ archivedCount: number; prunedCount: number; destinationKey: string }> {
    const expiredLogs = logs.filter(l => l.tenantId === tenantId && new Date(l.createdAt).getTime() < cutoffDate.getTime());
    if (expiredLogs.length === 0) {
      return { archivedCount: 0, prunedCount: 0, destinationKey: '' };
    }

    const partitionKey = `archive-${cutoffDate.toISOString().slice(0, 7)}`;
    const uploadResult = await this.storageAdapter.uploadLogs(tenantId, partitionKey, expiredLogs);

    return {
      archivedCount: expiredLogs.length,
      prunedCount: expiredLogs.length,
      destinationKey: uploadResult.key,
    };
  }
}
