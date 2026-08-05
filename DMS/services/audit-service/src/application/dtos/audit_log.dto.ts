import { AuditLogSource, AuditLogStatus } from '../../domain/entities/audit_log.entity.js';

export interface CreateAuditLogDto {
  id?: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  source?: AuditLogSource;
  correlationId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  status?: AuditLogStatus;
  idempotencyKey?: string;
}

export interface UpdateAuditLogStatusDto {
  status: AuditLogStatus;
  expectedVersion: number;
}

export interface AuditLogResponseDto {
  id: string;
  tenantId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  source: AuditLogSource;
  correlationId?: string | null;
  details: Record<string, any>;
  ipAddress?: string | null;
  status: AuditLogStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ListAuditLogsQueryDto {
  actorId?: string;
  action?: string;
  entityType?: string;
  status?: AuditLogStatus;
  page?: number;
  pageSize?: number;
}
