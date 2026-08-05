import { ReportAggregate, ReportStatus, ReportType } from '../entities/report.entity.js';

export interface ReportFilter {
  tenantId: string;
  name?: string;
  type?: ReportType;
  status?: ReportStatus;
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'name';
  sortOrder?: 'asc' | 'desc';
}

export interface ReportRepository {
  save(report: ReportAggregate): Promise<ReportAggregate>;
  findById(id: string, tenantId: string): Promise<ReportAggregate | null>;
  findAll(filter: ReportFilter): Promise<{ reports: ReportAggregate[]; total: number; page: number; pageSize: number }>;
  delete(id: string, tenantId: string): Promise<boolean>;
}
