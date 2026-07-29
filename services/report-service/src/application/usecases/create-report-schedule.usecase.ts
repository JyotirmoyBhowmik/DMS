import { randomUUID } from 'node:crypto';
import { ReportScheduleAggregate } from '../../domain/entities/report_schedule.entity.js';
import { ReportScheduleRepository } from '../../domain/repositories/report_schedule.repository.js';
import { validateCreateReportScheduleInput } from '../../domain/validation/report_schedule.validation.js';
import { ReportAuditService } from '../../infrastructure/audit/report.audit.js';
import { CreateReportScheduleDto, ReportScheduleResponseDto } from '../dtos/report_schedule.dto.js';
import { Principal } from './create-report.usecase.js';

export class CreateReportScheduleUseCase {
  private static processedKeys: Set<string> = new Set<string>();

  constructor(
    private readonly repository: ReportScheduleRepository,
    private readonly auditService: ReportAuditService = new ReportAuditService()
  ) {}

  public async execute(principal: Principal, dto: CreateReportScheduleDto): Promise<ReportScheduleResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('report:schedule:create') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to create report schedule.');
    }

    validateCreateReportScheduleInput(dto);

    if (dto.idempotencyKey) {
      const key = `${principal.tenantId}:${dto.idempotencyKey}`;
      if (CreateReportScheduleUseCase.processedKeys.has(key)) {
        throw new Error(`Duplicate request: Idempotency key '${dto.idempotencyKey}' already processed.`);
      }
      CreateReportScheduleUseCase.processedKeys.add(key);
    }

    const scheduleId = dto.id ?? randomUUID();

    const schedule = ReportScheduleAggregate.create({
      id: scheduleId,
      tenantId: principal.tenantId,
      reportName: dto.reportName.trim(),
      cronExpression: dto.cronExpression.trim(),
      frequency: dto.frequency
    });

    await this.repository.save(schedule);

    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: 'REPORT_SCHEDULE_CREATED',
      entityId: schedule.id,
      newValue: { reportName: schedule.reportName, cronExpression: schedule.cronExpression, status: schedule.status }
    });

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
