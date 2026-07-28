import { AuditLogAggregate } from '../../domain/entities/audit_log.entity.js';
import { AuditLogRepository } from '../../domain/repositories/audit_log.repository.js';
import { AuditLogResponseDto } from '../dtos/audit_log.dto.js';
import { Principal } from './create-audit-log.usecase.js';

export class GetAuditLogUseCase {
  constructor(private readonly repository: AuditLogRepository) {}

  public async execute(principal: Principal, id: string): Promise<AuditLogResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('audit:read') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to view audit log.');
    }
    if (!id || id.trim().length === 0) {
      throw new Error('AuditLog ID is required.');
    }

    const auditLog = await this.repository.findById(id, principal.tenantId);
    if (!auditLog) {
      throw new Error(`AuditLog with ID '${id}' not found.`);
    }

    return this.mapToResponse(auditLog);
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
