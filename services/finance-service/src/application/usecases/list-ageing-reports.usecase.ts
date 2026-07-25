import { AgeingReportRepository, ListAgeingReportsOptions } from '../../domain/repositories/ageing-report.repository.js';
import { AgeingReport, AgeingReportDomainError } from '../../domain/entities/ageing-report.entity.js';
import { Principal } from './create-invoice.usecase.js';

export class ListAgeingReportsUseCase {
  constructor(private readonly repository: AgeingReportRepository) {}

  async execute(principal: Principal, options?: ListAgeingReportsOptions): Promise<{ items: AgeingReport[]; total: number; page: number; limit: number }> {
    if (!principal || !principal.tenantId) {
      throw new AgeingReportDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('finance:ageing_report:read') ||
      principal.permissions.includes('finance:*');

    if (!hasPermission) {
      throw new AgeingReportDomainError('Forbidden: Insufficient permissions to list ageing reports');
    }

    const page = Math.max(1, options?.page || 1);
    const limit = Math.min(Math.max(1, options?.limit || 20), 100); // Mandatory max cap 100

    const { items, total } = await this.repository.list(principal.tenantId, {
      ...options,
      page,
      limit,
    });

    return {
      items,
      total,
      page,
      limit,
    };
  }
}
