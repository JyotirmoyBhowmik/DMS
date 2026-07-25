import { TaxFilingRepository } from '../../domain/repositories/tax-filing.repository.js';
import { TaxFiling, TaxFilingDomainError } from '../../domain/entities/tax-filing.entity.js';
import { CreateTaxFilingDto } from '../dtos/tax-filing.dto.js';
import { validateCreateTaxFilingInput } from '../../domain/validation/tax-filing.validation.js';
import { Principal } from './create-invoice.usecase.js';
import { TaxFilingAuditService } from '../../infrastructure/audit/tax-filing.audit.js';

export class CreateTaxFilingUseCase {
  private auditService = new TaxFilingAuditService();

  constructor(private readonly repository: TaxFilingRepository) {}

  async execute(principal: Principal, dto: CreateTaxFilingDto, idempotencyKey?: string, correlationId?: string): Promise<TaxFiling> {
    if (!principal || !principal.tenantId) {
      throw new TaxFilingDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('finance:tax_filing:create') ||
      principal.permissions.includes('finance:*');

    if (!hasPermission) {
      throw new TaxFilingDomainError('Forbidden: Insufficient permissions to create TaxFiling');
    }

    validateCreateTaxFilingInput(dto);

    const effectiveIdempotencyKey = idempotencyKey || dto.idempotencyKey;

    if (effectiveIdempotencyKey) {
      const existing = await this.repository.findByPeriodAndType(dto.period, dto.taxType, principal.tenantId);
      if (existing && existing.idempotencyKey === effectiveIdempotencyKey) {
        return existing;
      }
    }

    const duplicate = await this.repository.findByPeriodAndType(dto.period, dto.taxType, principal.tenantId);
    if (duplicate) {
      throw new TaxFilingDomainError(`TaxFiling for period '${dto.period}' and type '${dto.taxType}' already exists`);
    }

    const taxFiling = new TaxFiling({
      tenantId: principal.tenantId,
      period: dto.period,
      taxType: dto.taxType,
      taxableAmountCents: dto.taxableAmountCents || 0,
      taxAmountCents: dto.taxAmountCents || 0,
      status: 'DRAFT',
      acknowledgementNumber: dto.acknowledgementNumber,
      filingDate: dto.filingDate ? new Date(dto.filingDate) : undefined,
      idempotencyKey: effectiveIdempotencyKey,
      version: 1,
    });

    const saved = await this.repository.save(taxFiling, principal.tenantId);

    // Audit trail
    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: 'TAX_FILING_CREATED',
      entityType: 'TaxFiling',
      entityId: saved.id,
      correlationId: correlationId || 'N/A',
      source: 'API',
      newValue: saved.toJSON(),
    });

    return saved;
  }
}
