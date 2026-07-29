import { CreateReportScheduleDto } from '../../application/dtos/report_schedule.dto.js';
import { ScheduleFrequency } from '../entities/report_schedule.entity.js';

export function validateCreateReportScheduleInput(dto: CreateReportScheduleDto): void {
  if (!dto) {
    throw new Error('ReportSchedule payload is required.');
  }
  if (!dto.reportName || dto.reportName.trim().length === 0) {
    throw new Error('ReportSchedule reportName is required.');
  }
  if (!dto.cronExpression || dto.cronExpression.trim().length === 0) {
    throw new Error('ReportSchedule cronExpression is required.');
  }

  const validFrequencies: ScheduleFrequency[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'CRON'];
  if (dto.frequency && !validFrequencies.includes(dto.frequency)) {
    throw new Error(`Invalid ReportSchedule frequency: ${dto.frequency}`);
  }
}
