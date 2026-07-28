import { randomUUID } from 'node:crypto';
import { AuditLogAggregate } from '../../domain/entities/audit_log.entity.js';
import { AuditLogRepository } from '../../domain/repositories/audit_log.repository.js';
import { redactSensitiveAuditDetails, validateCreateAuditLogInput } from '../../domain/validation/audit_log.validation.js';
import { AuditLogResponseDto, CreateAuditLogDto } from '../dtos/audit_log.dto.js';

export interface Principal {
  userId: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
}

export class CreateAuditLogUseCase {
  private static processedKeys: Set<string> = new Set<string>();

  constructor(private readonly repository: AuditLogRepository) {}

  public async execute(principal: Principal, dto: CreateAuditLogDto): Promise<AuditLogResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('audit:create') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to create audit log.');
    }

    validateCreateAuditLogInput(dto);

    if (dto.idempotencyKey) {
      const key = `${principal.tenantId}:${dto.idempotencyKey}`;
      if (CreateAuditLogUseCase.processedKeys.has(key)) {
        throw new Error(`Duplicate request: Idempotency key '${dto.idempotencyKey}' already processed.`);
      }
      CreateAuditLogUseCase.processedKeys.add(key);
    }

    const sanitizedDetails = dto.details ? redactSensitiveAuditDetails(dto.details) : {};

    const auditLogId = dto.id ?? randomUUID();
    const auditLog = AuditLogAggregate.create({
      id: auditLogId,
      tenantId: principal.tenantId,
      actorId: dto.actorId,
      action: dto.action,
      entityType: dto.entityType,
      entityId: dto.entityId,
      source: dto.source,
      correlationId: dto.correlationId,
      details: sanitizedDetails,
      ipAddress: dto.ipAddress,
      status: dto.status
    });

    await this.repository.save(auditLog);

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
