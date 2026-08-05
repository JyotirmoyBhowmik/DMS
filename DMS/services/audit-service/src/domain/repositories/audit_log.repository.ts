import { AuditLogAggregate, AuditLogSource, AuditLogStatus } from '../entities/audit_log.entity.js';

export interface AuditLogFilter {
  tenantId: string;
  actorId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  source?: AuditLogSource;
  status?: AuditLogStatus;
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'action' | 'actorId';
  sortOrder?: 'asc' | 'desc';
}

export interface AuditLogRepository {
  save(auditLog: AuditLogAggregate): Promise<AuditLogAggregate>;
  findById(id: string, tenantId: string): Promise<AuditLogAggregate | null>;
  findAll(filter: AuditLogFilter): Promise<{ auditLogs: AuditLogAggregate[]; total: number; page: number; pageSize: number }>;
  delete(id: string, tenantId: string): Promise<boolean>;
}
