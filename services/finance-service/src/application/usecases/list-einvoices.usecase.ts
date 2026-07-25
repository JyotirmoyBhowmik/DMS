import { EInvoiceRepository, ListEInvoicesOptions } from '../../domain/repositories/einvoice.repository.js';
import { EInvoice, EInvoiceDomainError } from '../../domain/entities/einvoice.entity.js';
import { Principal } from './create-invoice.usecase.js';

export class ListEInvoicesUseCase {
  constructor(private readonly repository: EInvoiceRepository) {}

  async execute(principal: Principal, options?: ListEInvoicesOptions): Promise<{ items: EInvoice[]; total: number; page: number; limit: number }> {
    if (!principal || !principal.tenantId) {
      throw new EInvoiceDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('finance:einvoice:read') ||
      principal.permissions.includes('finance:*');

    if (!hasPermission) {
      throw new EInvoiceDomainError('Forbidden: Insufficient permissions to list eInvoices');
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
