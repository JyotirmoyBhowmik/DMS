import { AgeingReportRepository } from '../../domain/repositories/ageing-report.repository.js';
import { AgeingReport, AgeingReportDomainError } from '../../domain/entities/ageing-report.entity.js';
import { UpdateAgeingReportDto } from '../dtos/ageing-report.dto.js';
import { validateUpdateAgeingReportInput } from '../../domain/validation/ageing-report.validation.js';
import { Principal } from './create-invoice.usecase.js';
import { AgeingReportAuditService } from '../../infrastructure/audit/ageing-report.audit.js';

export class UpdateAgeingReportUseCase {
  private auditService = new AgeingReportAuditService();

  constructor(private readonly repository: AgeingReportRepository) {}

  async execute(id: string, principal: Principal, dto: UpdateAgeingReportDto, correlationId?: string): Promise<AgeingReport> {
    if (!principal || !principal.tenantId) {
      throw new AgeingReportDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('finance:ageing_report:update') ||
      principal.permissions.includes('finance:*');

    if (!hasPermission) {
      throw new AgeingReportDomainError('Forbidden: Insufficient permissions to update ageing report');
    }

    validateUpdateAgeingReportInput(dto);

    const existing = await this.repository.findById(id, principal.tenantId);
    if (!existing) {
      throw new AgeingReportDomainError(`AgeingReport with id '${id}' not found`);
    }

    if (existing.version !== dto.version) {
      throw new AgeingReportDomainError(
        `Optimistic locking conflict: report version is ${existing.version}, provided version is ${dto.version}`
      );
    }

    const oldValue = existing.toJSON();
    existing.transitionTo(dto.status);

    const updated = await this.repository.update(existing, principal.tenantId);

    // Audit trail
    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: `AGEING_REPORT_UPDATED_${dto.status}`,
      entityType: 'AgeingReport',
      entityId: updated.id,
      correlationId: correlationId || 'N/A',
      source: 'API',
      oldValue,
      newValue: updated.toJSON(),
    });

    return updated;
  }
}
