import { ReportAggregate } from '../../domain/entities/report.entity.js';
import { ReportRepository } from '../../domain/repositories/report.repository.js';
import { ListReportsQueryDto, ReportResponseDto } from '../dtos/report.dto.js';
import { Principal } from './create-report.usecase.js';

export interface PaginatedReportsResponseDto {
  reports: ReportResponseDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class ListReportsUseCase {
  constructor(private readonly repository: ReportRepository) {}

  public async execute(principal: Principal, query: ListReportsQueryDto): Promise<PaginatedReportsResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('report:read') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to list reports.');
    }

    const result = await this.repository.findAll({
      tenantId: principal.tenantId,
      name: query.name,
      type: query.type,
      status: query.status,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20
    });

    return {
      reports: result.reports.map(r => this.mapToResponse(r)),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    };
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
