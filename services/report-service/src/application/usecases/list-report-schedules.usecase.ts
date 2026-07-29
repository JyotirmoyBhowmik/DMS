import { ReportScheduleAggregate } from '../../domain/entities/report_schedule.entity.js';
import { ReportScheduleRepository } from '../../domain/repositories/report_schedule.repository.js';
import { ListReportSchedulesQueryDto, ReportScheduleResponseDto } from '../dtos/report_schedule.dto.js';
import { Principal } from './create-report.usecase.js';

export interface PaginatedReportSchedulesResponseDto {
  schedules: ReportScheduleResponseDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class ListReportSchedulesUseCase {
  constructor(private readonly repository: ReportScheduleRepository) {}

  public async execute(principal: Principal, query: ListReportSchedulesQueryDto): Promise<PaginatedReportSchedulesResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('report:schedule:read') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to list report schedules.');
    }

    const result = await this.repository.findAll({
      tenantId: principal.tenantId,
      reportName: query.reportName,
      frequency: query.frequency,
      status: query.status,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20
    });

    return {
      schedules: result.schedules.map(s => this.mapToResponse(s)),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    };
  }

  private mapToResponse(schedule: ReportScheduleAggregate): ReportScheduleResponseDto {
    return {
      id: schedule.id,
      tenantId: schedule.tenantId,
      reportName: schedule.reportName,
      cronExpression: schedule.cronExpression,
      frequency: schedule.frequency,
      status: schedule.status,
      nextRunAt: schedule.nextRunAt ? schedule.nextRunAt.toISOString() : null,
      version: schedule.version,
      createdAt: schedule.createdAt.toISOString(),
      updatedAt: schedule.updatedAt.toISOString()
    };
  }
}
