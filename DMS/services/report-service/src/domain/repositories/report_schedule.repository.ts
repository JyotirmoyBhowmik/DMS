import { ReportScheduleAggregate, ScheduleFrequency, ScheduleStatus } from '../entities/report_schedule.entity.js';

export interface ReportScheduleFilter {
  tenantId: string;
  reportName?: string;
  frequency?: ScheduleFrequency;
  status?: ScheduleStatus;
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'reportName';
  sortOrder?: 'asc' | 'desc';
}

export interface ReportScheduleRepository {
  save(schedule: ReportScheduleAggregate): Promise<ReportScheduleAggregate>;
  findById(id: string, tenantId: string): Promise<ReportScheduleAggregate | null>;
  findAll(filter: ReportScheduleFilter): Promise<{ schedules: ReportScheduleAggregate[]; total: number; page: number; pageSize: number }>;
  delete(id: string, tenantId: string): Promise<boolean>;
}
