import { TaxFilingRepository } from '../../domain/repositories/tax-filing.repository.js';
import { TaxFiling, TaxFilingDomainError } from '../../domain/entities/tax-filing.entity.js';
import { UpdateTaxFilingDto } from '../dtos/tax-filing.dto.js';
import { validateUpdateTaxFilingInput } from '../../domain/validation/tax-filing.validation.js';
import { Principal } from './create-invoice.usecase.js';
import { TaxFilingAuditService } from '../../infrastructure/audit/tax-filing.audit.js';

export class UpdateTaxFilingUseCase {
  private auditService = new TaxFilingAuditService();

  constructor(private readonly repository: TaxFilingRepository) {}

  async execute(id: string, principal: Principal, dto: UpdateTaxFilingDto, correlationId?: string): Promise<TaxFiling> {
    if (!principal || !principal.tenantId) {
      throw new TaxFilingDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('finance:tax_filing:update') ||
      principal.permissions.includes('finance:*');

    if (!hasPermission) {
      throw new TaxFilingDomainError('Forbidden: Insufficient permissions to update TaxFiling');
    }

    validateUpdateTaxFilingInput(dto);

    const existing = await this.repository.findById(id, principal.tenantId);
    if (!existing) {
      throw new TaxFilingDomainError(`TaxFiling with id '${id}' not found`);
    }

    if (existing.version !== dto.version) {
      throw new TaxFilingDomainError(
        `Optimistic locking conflict: TaxFiling version is ${existing.version}, provided version is ${dto.version}`
      );
    }

    const oldValue = existing.toJSON();
    
    if (dto.status === 'FILED') {
      existing.file(dto.acknowledgementNumber);
    } else if (dto.status === 'ACCEPTED') {
      existing.accept();
    } else if (dto.status === 'REJECTED') {
      existing.reject();
    } else {
      existing.transitionTo(dto.status);
    }

    const updated = await this.repository.update(existing, principal.tenantId);

    // Audit trail
    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: `TAX_FILING_UPDATED_${dto.status}`,
      entityType: 'TaxFiling',
      entityId: updated.id,
      correlationId: correlationId || 'N/A',
      source: 'API',
      oldValue,
      newValue: updated.toJSON(),
    });

    return updated;
  }
}
