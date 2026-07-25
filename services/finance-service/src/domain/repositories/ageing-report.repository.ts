import { AgeingReport, AgeingReportStatus } from '../entities/ageing-report.entity.js';

export interface ListAgeingReportsOptions {
  page?: number;
  limit?: number;
  status?: AgeingReportStatus;
  distributorId?: string;
  sortBy?: 'createdAt' | 'asOfDate' | 'totalOutstandingCents';
  sortOrder?: 'ASC' | 'DESC';
}

export interface AgeingReportRepository {
  save(report: AgeingReport, tenantId: string): Promise<AgeingReport>;
  findById(id: string, tenantId: string): Promise<AgeingReport | null>;
  findByDistributorAndDate(distributorId: string, asOfDate: Date, tenantId: string): Promise<AgeingReport | null>;
  list(tenantId: string, options?: ListAgeingReportsOptions): Promise<{ items: AgeingReport[]; total: number }>;
  update(report: AgeingReport, tenantId: string): Promise<AgeingReport>;
  delete(id: string, tenantId: string): Promise<boolean>;
}
