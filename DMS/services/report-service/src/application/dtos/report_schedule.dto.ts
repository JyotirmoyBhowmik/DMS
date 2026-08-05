import { ScheduleFrequency, ScheduleStatus } from '../../domain/entities/report_schedule.entity.js';

export interface CreateReportScheduleDto {
  id?: string;
  reportName: string;
  cronExpression: string;
  frequency?: ScheduleFrequency;
  idempotencyKey?: string;
}

export interface UpdateReportScheduleDto {
  cronExpression?: string;
  frequency?: ScheduleFrequency;
  status?: ScheduleStatus;
  expectedVersion: number;
}

export interface ReportScheduleResponseDto {
  id: string;
  tenantId: string;
  reportName: string;
  cronExpression: string;
  frequency: ScheduleFrequency;
  status: ScheduleStatus;
  nextRunAt?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ListReportSchedulesQueryDto {
  reportName?: string;
  frequency?: ScheduleFrequency;
  status?: ScheduleStatus;
  page?: number;
  pageSize?: number;
}
