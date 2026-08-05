import { ReportScheduleAggregate } from '../../domain/entities/report_schedule.entity.js';
import { ReportScheduleRepository } from '../../domain/repositories/report_schedule.repository.js';
import { ReportScheduleResponseDto } from '../dtos/report_schedule.dto.js';
import { Principal } from './create-report.usecase.js';

export class GetReportScheduleUseCase {
  constructor(private readonly repository: ReportScheduleRepository) {}

  public async execute(principal: Principal, id: string): Promise<ReportScheduleResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('report:schedule:read') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to view report schedule.');
    }
    if (!id || id.trim().length === 0) {
      throw new Error('ReportSchedule ID is required.');
    }

    const schedule = await this.repository.findById(id, principal.tenantId);
    if (!schedule) {
      throw new Error(`ReportSchedule with ID '${id}' not found.`);
    }

    return this.mapToResponse(schedule);
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
