import { TaxFilingRepository, ListTaxFilingsOptions } from '../../domain/repositories/tax-filing.repository.js';
import { TaxFiling, TaxFilingDomainError } from '../../domain/entities/tax-filing.entity.js';
import { Principal } from './create-invoice.usecase.js';

export class ListTaxFilingsUseCase {
  constructor(private readonly repository: TaxFilingRepository) {}

  async execute(principal: Principal, options?: ListTaxFilingsOptions): Promise<{ items: TaxFiling[]; total: number; page: number; limit: number }> {
    if (!principal || !principal.tenantId) {
      throw new TaxFilingDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('finance:tax_filing:read') ||
      principal.permissions.includes('finance:*');

    if (!hasPermission) {
      throw new TaxFilingDomainError('Forbidden: Insufficient permissions to list TaxFilings');
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
