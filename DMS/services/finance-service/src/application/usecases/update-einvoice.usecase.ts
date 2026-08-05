import { EInvoiceRepository } from '../../domain/repositories/einvoice.repository.js';
import { EInvoice, EInvoiceDomainError } from '../../domain/entities/einvoice.entity.js';
import { UpdateEInvoiceDto } from '../dtos/einvoice.dto.js';
import { validateUpdateEInvoiceInput } from '../../domain/validation/einvoice.validation.js';
import { Principal } from './create-invoice.usecase.js';
import { EInvoiceAuditService } from '../../infrastructure/audit/einvoice.audit.js';

export class UpdateEInvoiceUseCase {
  private auditService = new EInvoiceAuditService();

  constructor(private readonly repository: EInvoiceRepository) {}

  async execute(id: string, principal: Principal, dto: UpdateEInvoiceDto, correlationId?: string): Promise<EInvoice> {
    if (!principal || !principal.tenantId) {
      throw new EInvoiceDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('finance:einvoice:update') ||
      principal.permissions.includes('finance:*');

    if (!hasPermission) {
      throw new EInvoiceDomainError('Forbidden: Insufficient permissions to update eInvoice');
    }

    validateUpdateEInvoiceInput(dto);

    const existing = await this.repository.findById(id, principal.tenantId);
    if (!existing) {
      throw new EInvoiceDomainError(`EInvoice with id '${id}' not found`);
    }

    if (existing.version !== dto.version) {
      throw new EInvoiceDomainError(
        `Optimistic locking conflict: eInvoice version is ${existing.version}, provided version is ${dto.version}`
      );
    }

    const oldValue = existing.toJSON();
    existing.transitionTo(dto.status);

    const updated = await this.repository.update(existing, principal.tenantId);

    // Audit trail
    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: `EINVOICE_UPDATED_${dto.status}`,
      entityType: 'EInvoice',
      entityId: updated.id,
      correlationId: correlationId || 'N/A',
      source: 'API',
      oldValue,
      newValue: updated.toJSON(),
    });

    return updated;
  }
}
