import { AuditLogAggregate } from '../../domain/entities/audit_log.entity.js';
import { AuditLogRepository } from '../../domain/repositories/audit_log.repository.js';
import { AuditLogResponseDto, UpdateAuditLogStatusDto } from '../dtos/audit_log.dto.js';
import { Principal } from './create-audit-log.usecase.js';

export class UpdateAuditLogUseCase {
  constructor(private readonly repository: AuditLogRepository) {}

  public async updateStatus(principal: Principal, id: string, dto: UpdateAuditLogStatusDto): Promise<AuditLogResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('audit:update') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to update audit log status.');
    }

    const auditLog = await this.repository.findById(id, principal.tenantId);
    if (!auditLog) {
      throw new Error(`AuditLog with ID '${id}' not found.`);
    }

    auditLog.updateStatus(dto.status, dto.expectedVersion);

    await this.repository.save(auditLog);

    return this.mapToResponse(auditLog);
  }

  public async deleteAuditLog(principal: Principal, id: string): Promise<boolean> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('audit:delete') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to delete audit log.');
    }

    const existing = await this.repository.findById(id, principal.tenantId);
    if (!existing) {
      throw new Error(`AuditLog with ID '${id}' not found.`);
    }

    return await this.repository.delete(id, principal.tenantId);
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
