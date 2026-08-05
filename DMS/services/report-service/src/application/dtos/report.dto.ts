import { ReportStatus, ReportType } from '../../domain/entities/report.entity.js';

export interface CreateReportDto {
  id?: string;
  name: string;
  type: ReportType;
  parameters?: Record<string, any>;
  idempotencyKey?: string;
}

export interface UpdateReportDto {
  name?: string;
  status?: ReportStatus;
  downloadUrl?: string;
  expectedVersion: number;
}

export interface ReportResponseDto {
  id: string;
  tenantId: string;
  name: string;
  type: ReportType;
  parameters: Record<string, any>;
  status: ReportStatus;
  downloadUrl?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ListReportsQueryDto {
  name?: string;
  type?: ReportType;
  status?: ReportStatus;
  page?: number;
  pageSize?: number;
}
