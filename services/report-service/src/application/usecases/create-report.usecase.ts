import { randomUUID } from 'node:crypto';
import { ReportAggregate } from '../../domain/entities/report.entity.js';
import { ReportRepository } from '../../domain/repositories/report.repository.js';
import { sanitizeParameters, validateCreateReportInput } from '../../domain/validation/report.validation.js';
import { ReportAuditService } from '../../infrastructure/audit/report.audit.js';
import { CreateReportDto, ReportResponseDto } from '../dtos/report.dto.js';

export interface Principal {
  userId: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
}

export class CreateReportUseCase {
  private static processedKeys: Set<string> = new Set<string>();

  constructor(
    private readonly repository: ReportRepository,
    private readonly auditService: ReportAuditService = new ReportAuditService()
  ) {}

  public async execute(principal: Principal, dto: CreateReportDto): Promise<ReportResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('report:create') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to create report.');
    }

    validateCreateReportInput(dto);

    if (dto.idempotencyKey) {
      const key = `${principal.tenantId}:${dto.idempotencyKey}`;
      if (CreateReportUseCase.processedKeys.has(key)) {
        throw new Error(`Duplicate request: Idempotency key '${dto.idempotencyKey}' already processed.`);
      }
      CreateReportUseCase.processedKeys.add(key);
    }

    const cleanParams = sanitizeParameters(dto.parameters ?? {});
    const reportId = dto.id ?? randomUUID();

    const report = ReportAggregate.create({
      id: reportId,
      tenantId: principal.tenantId,
      name: dto.name.trim(),
      type: dto.type,
      parameters: cleanParams
    });

    await this.repository.save(report);

    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: 'REPORT_CREATED',
      entityId: report.id,
      newValue: { name: report.name, type: report.type, status: report.status }
    });

    return this.mapToResponse(report);
  }

  private mapToResponse(report: ReportAggregate): ReportResponseDto {
    return {
      id: report.id,
      tenantId: report.tenantId,
      name: report.name,
      type: report.type,
      parameters: report.parameters,
      status: report.status,
      downloadUrl: report.downloadUrl,
      version: report.version,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString()
    };
  }
}
