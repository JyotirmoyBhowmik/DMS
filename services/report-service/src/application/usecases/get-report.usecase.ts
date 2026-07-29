import { ReportAggregate } from '../../domain/entities/report.entity.js';
import { ReportRepository } from '../../domain/repositories/report.repository.js';
import { ReportResponseDto } from '../dtos/report.dto.js';
import { Principal } from './create-report.usecase.js';

export class GetReportUseCase {
  constructor(private readonly repository: ReportRepository) {}

  public async execute(principal: Principal, id: string): Promise<ReportResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('report:read') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to view report.');
    }
    if (!id || id.trim().length === 0) {
      throw new Error('Report ID is required.');
    }

    const report = await this.repository.findById(id, principal.tenantId);
    if (!report) {
      throw new Error(`Report with ID '${id}' not found.`);
    }

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
