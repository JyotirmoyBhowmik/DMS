import { TaxFilingRepository } from '../../domain/repositories/tax-filing.repository.js';
import { TaxFiling, TaxFilingDomainError } from '../../domain/entities/tax-filing.entity.js';
import { Principal } from './create-invoice.usecase.js';

export class GetTaxFilingUseCase {
  constructor(private readonly repository: TaxFilingRepository) {}

  async execute(id: string, principal: Principal): Promise<TaxFiling> {
    if (!principal || !principal.tenantId) {
      throw new TaxFilingDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('finance:tax_filing:read') ||
      principal.permissions.includes('finance:*');

    if (!hasPermission) {
      throw new TaxFilingDomainError('Forbidden: Insufficient permissions to read TaxFiling');
    }

    const taxFiling = await this.repository.findById(id, principal.tenantId);
    if (!taxFiling) {
      throw new TaxFilingDomainError(`TaxFiling with id '${id}' not found`);
    }

    return taxFiling;
  }
}
