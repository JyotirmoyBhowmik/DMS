import { ReportAggregate } from '../../domain/entities/report.entity.js';
import { ReportRepository } from '../../domain/repositories/report.repository.js';
import { ReportAuditService } from '../../infrastructure/audit/report.audit.js';
import { ReportResponseDto, UpdateReportDto } from '../dtos/report.dto.js';
import { Principal } from './create-report.usecase.js';

export class UpdateReportUseCase {
  constructor(
    private readonly repository: ReportRepository,
    private readonly auditService: ReportAuditService = new ReportAuditService()
  ) {}

  public async execute(principal: Principal, id: string, dto: UpdateReportDto): Promise<ReportResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('report:update') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to update report.');
    }

    const report = await this.repository.findById(id, principal.tenantId);
    if (!report) {
      throw new Error(`Report with ID '${id}' not found.`);
    }

    const oldState = { name: report.name, status: report.status, version: report.version };

    if (dto.name) {
      report.updateName(dto.name, dto.expectedVersion);
    } else if (dto.status) {
      if (dto.status === 'GENERATING') {
        report.startGenerating(dto.expectedVersion);
      } else if (dto.status === 'COMPLETED') {
        report.markCompleted(dto.downloadUrl ?? '/downloads/report.pdf', dto.expectedVersion);
      } else if (dto.status === 'FAILED') {
        report.markFailed(dto.expectedVersion);
      }
    }

    await this.repository.save(report);

    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: 'REPORT_UPDATED',
      entityId: report.id,
      oldValue: oldState,
      newValue: { name: report.name, status: report.status, version: report.version }
    });

    return this.mapToResponse(report);
  }

  public async approveReport(principal: Principal, id: string): Promise<ReportResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('report:approve') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to approve report.');
    }

    const report = await this.repository.findById(id, principal.tenantId);
    if (!report) {
      throw new Error(`Report with ID '${id}' not found.`);
    }

    const oldStatus = report.status;
    report.approve();

    await this.repository.save(report);

    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: 'REPORT_APPROVED',
      entityId: report.id,
      oldValue: { status: oldStatus },
      newValue: { status: report.status }
    });

    return this.mapToResponse(report);
  }

  public async deleteReport(principal: Principal, id: string): Promise<boolean> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('report:delete') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to delete report.');
    }

    const existing = await this.repository.findById(id, principal.tenantId);
    if (!existing) {
      throw new Error(`Report with ID '${id}' not found.`);
    }

    const deleted = await this.repository.delete(id, principal.tenantId);

    if (deleted) {
      await this.auditService.recordMutation({
        tenantId: principal.tenantId,
        actorId: principal.userId,
        action: 'REPORT_DELETED',
        entityId: id,
        oldValue: { status: existing.status }
      });
    }

    return deleted;
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
