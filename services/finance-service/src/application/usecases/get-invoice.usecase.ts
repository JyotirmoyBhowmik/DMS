import { InvoiceRepository } from '../../domain/repositories/invoice.repository.js';
import { Invoice, InvoiceDomainError } from '../../domain/entities/invoice.entity.js';
import { Principal } from './create-invoice.usecase.js';

export class GetInvoiceUseCase {
  constructor(private readonly repository: InvoiceRepository) {}

  async execute(principal: Principal, id: string): Promise<Invoice> {
    if (!principal || !principal.tenantId) {
      throw new InvoiceDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('finance:invoice:read') ||
      principal.permissions.includes('finance:*');

    if (!hasPermission) {
      throw new InvoiceDomainError('Forbidden: Insufficient permissions to read invoice');
    }

    const found = await this.repository.findById(id, principal.tenantId);
    if (!found) {
      throw new InvoiceDomainError(`Invoice with id '${id}' not found`);
    }

    return found;
  }
}
