import { ReportScheduleAggregate } from '../../domain/entities/report_schedule.entity.js';
import { ReportScheduleRepository } from '../../domain/repositories/report_schedule.repository.js';
import { ReportAuditService } from '../../infrastructure/audit/report.audit.js';
import { ReportScheduleResponseDto, UpdateReportScheduleDto } from '../dtos/report_schedule.dto.js';
import { Principal } from './create-report.usecase.js';

export class UpdateReportScheduleUseCase {
  constructor(
    private readonly repository: ReportScheduleRepository,
    private readonly auditService: ReportAuditService = new ReportAuditService()
  ) {}

  public async execute(principal: Principal, id: string, dto: UpdateReportScheduleDto): Promise<ReportScheduleResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('report:schedule:update') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to update report schedule.');
    }

    const schedule = await this.repository.findById(id, principal.tenantId);
    if (!schedule) {
      throw new Error(`ReportSchedule with ID '${id}' not found.`);
    }

    const oldState = { cronExpression: schedule.cronExpression, status: schedule.status, version: schedule.version };

    if (dto.cronExpression) {
      schedule.updateSchedule(dto.cronExpression, dto.frequency ?? schedule.frequency, dto.expectedVersion);
    } else if (dto.status) {
      if (dto.status === 'PAUSED') {
        schedule.pause(dto.expectedVersion);
      } else if (dto.status === 'ACTIVE') {
        schedule.resume(dto.expectedVersion);
      } else if (dto.status === 'INACTIVE') {
        schedule.deactivate(dto.expectedVersion);
      }
    }

    await this.repository.save(schedule);

    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: 'REPORT_SCHEDULE_UPDATED',
      entityId: schedule.id,
      oldValue: oldState,
      newValue: { cronExpression: schedule.cronExpression, status: schedule.status, version: schedule.version }
    });

    return this.mapToResponse(schedule);
  }

  public async deleteSchedule(principal: Principal, id: string): Promise<boolean> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('report:schedule:delete') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to delete report schedule.');
    }

    const existing = await this.repository.findById(id, principal.tenantId);
    if (!existing) {
      throw new Error(`ReportSchedule with ID '${id}' not found.`);
    }

    const deleted = await this.repository.delete(id, principal.tenantId);

    if (deleted) {
      await this.auditService.recordMutation({
        tenantId: principal.tenantId,
        actorId: principal.userId,
        action: 'REPORT_SCHEDULE_DELETED',
        entityId: id,
        oldValue: { status: existing.status }
      });
    }

    return deleted;
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
