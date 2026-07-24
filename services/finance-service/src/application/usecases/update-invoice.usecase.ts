import { InvoiceRepository } from '../../domain/repositories/invoice.repository.js';
import { Invoice, InvoiceDomainError } from '../../domain/entities/invoice.entity.js';
import { UpdateInvoiceDto } from '../dtos/invoice.dto.js';
import { Principal } from './create-invoice.usecase.js';
import { validateUpdateInvoiceInput } from '../../domain/validation/invoice.validation.js';

export class UpdateInvoiceUseCase {
  constructor(private readonly repository: InvoiceRepository) {}

  async execute(principal: Principal, id: string, dto: UpdateInvoiceDto): Promise<Invoice> {
    if (!principal || !principal.tenantId) {
      throw new InvoiceDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('finance:invoice:update') ||
      principal.permissions.includes('finance:*');

    if (!hasPermission) {
      throw new InvoiceDomainError('Forbidden: Insufficient permissions to update invoice');
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

    if (dto.status) {
      existing.transitionTo(dto.status);
    }

    if (dto.paidAt && dto.status === 'PAID') {
      existing.pay(new Date(dto.paidAt));
    }

    const updated = await this.repository.update(existing, principal.tenantId);
    return updated;
  }
}
