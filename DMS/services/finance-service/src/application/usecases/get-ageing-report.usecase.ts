import { AgeingReportRepository } from '../../domain/repositories/ageing-report.repository.js';
import { AgeingReport, AgeingReportDomainError } from '../../domain/entities/ageing-report.entity.js';
import { Principal } from './create-invoice.usecase.js';

export class GetAgeingReportUseCase {
  constructor(private readonly repository: AgeingReportRepository) {}

  async execute(id: string, principal: Principal): Promise<AgeingReport> {
    if (!principal || !principal.tenantId) {
      throw new AgeingReportDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('finance:ageing_report:read') ||
      principal.permissions.includes('finance:*');

    if (!hasPermission) {
      throw new AgeingReportDomainError('Forbidden: Insufficient permissions to read ageing report');
    }

    const report = await this.repository.findById(id, principal.tenantId);
    if (!report) {
      throw new AgeingReportDomainError(`AgeingReport with id '${id}' not found`);
    }

    return report;
  }
}
