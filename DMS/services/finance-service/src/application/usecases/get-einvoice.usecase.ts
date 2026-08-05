import { EInvoiceRepository } from '../../domain/repositories/einvoice.repository.js';
import { EInvoice, EInvoiceDomainError } from '../../domain/entities/einvoice.entity.js';
import { Principal } from './create-invoice.usecase.js';

export class GetEInvoiceUseCase {
  constructor(private readonly repository: EInvoiceRepository) {}

  async execute(id: string, principal: Principal): Promise<EInvoice> {
    if (!principal || !principal.tenantId) {
      throw new EInvoiceDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('finance:einvoice:read') ||
      principal.permissions.includes('finance:*');

    if (!hasPermission) {
      throw new EInvoiceDomainError('Forbidden: Insufficient permissions to read eInvoice');
    }

    const einvoice = await this.repository.findById(id, principal.tenantId);
    if (!einvoice) {
      throw new EInvoiceDomainError(`EInvoice with id '${id}' not found`);
    }

    return einvoice;
  }
}
