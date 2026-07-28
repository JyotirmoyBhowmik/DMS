import { AuditLogAggregate } from '../../domain/entities/audit_log.entity.js';
import { AuditLogRepository } from '../../domain/repositories/audit_log.repository.js';
import { AuditLogResponseDto, ListAuditLogsQueryDto } from '../dtos/audit_log.dto.js';
import { Principal } from './create-audit-log.usecase.js';

export interface PaginatedAuditLogsResponseDto {
  auditLogs: AuditLogResponseDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class ListAuditLogsUseCase {
  constructor(private readonly repository: AuditLogRepository) {}

  public async execute(principal: Principal, query: ListAuditLogsQueryDto): Promise<PaginatedAuditLogsResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('audit:read') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to list audit logs.');
    }

    const result = await this.repository.findAll({
      tenantId: principal.tenantId,
      actorId: query.actorId,
      action: query.action,
      entityType: query.entityType,
      status: query.status,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20
    });

    return {
      auditLogs: result.auditLogs.map(a => this.mapToResponse(a)),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    };
  }

  private mapToResponse(auditLog: AuditLogAggregate): AuditLogResponseDto {
    return {
      id: auditLog.id,
      tenantId: auditLog.tenantId,
      actorId: auditLog.actorId,
      action: auditLog.action,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      source: auditLog.source,
      correlationId: auditLog.correlationId,
      details: auditLog.details,
      ipAddress: auditLog.ipAddress,
      status: auditLog.status,
      version: auditLog.version,
      createdAt: auditLog.createdAt.toISOString(),
      updatedAt: auditLog.updatedAt.toISOString()
    };
  }
}
