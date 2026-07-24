import { InvoiceRepository } from '../../domain/repositories/invoice.repository.js';
import { Invoice, InvoiceDomainError } from '../../domain/entities/invoice.entity.js';
import { UpdateInvoiceDto } from '../dtos/invoice.dto.js';
import { Principal } from './create-invoice.usecase.js';
import { validateUpdateInvoiceInput } from '../../domain/validation/invoice.validation.js';
import { InvoiceAuditService } from '../../infrastructure/audit/invoice.audit.js';

export class UpdateInvoiceUseCase {
  private auditService = new InvoiceAuditService();

  constructor(private readonly repository: InvoiceRepository) {}

  async execute(principal: Principal, id: string, dto: UpdateInvoiceDto, correlationId?: string): Promise<Invoice> {
    if (!principal || !principal.tenantId) {
      throw new InvoiceDomainError('Forbidden: Valid principal and tenantId are required');
    }

    // Default-deny permission check (Task 1241)
    const isApproveAction = dto.status === 'ISSUED' || dto.status === 'PAID';
    const requiredPermission = isApproveAction ? 'finance:invoice:approve' : 'finance:invoice:update';

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes(requiredPermission) ||
      principal.permissions.includes('finance:invoice:update') ||
      principal.permissions.includes('finance:*');

    if (!hasPermission) {
      throw new InvoiceDomainError(`Forbidden: Insufficient permissions to update invoice (${requiredPermission} required)`);
    }

    validateUpdateInvoiceInput(dto);

    const existing = await this.repository.findById(id, principal.tenantId);
    if (!existing) {
      throw new InvoiceDomainError(`Invoice with id '${id}' not found`);
    }

    if (existing.version !== dto.version) {
      throw new InvoiceDomainError(
        `Version conflict: Expected version ${existing.version}, got ${dto.version}`
      );
    }

    const oldValue = existing.toJSON();

    if (dto.status) {
      existing.transitionTo(dto.status);
    }

    if (dto.paidAt && dto.status === 'PAID') {
      existing.pay(new Date(dto.paidAt));
    }

    const updated = await this.repository.update(existing, principal.tenantId);

    // Audit logging hook (Task 1242)
    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: `INVOICE_UPDATED_${dto.status || 'STATE'}`,
      entityType: 'Invoice',
      entityId: updated.id,
      correlationId: correlationId || 'N/A',
      source: 'API',
      oldValue,
      newValue: updated.toJSON(),
    });

    return updated;
  }
}
