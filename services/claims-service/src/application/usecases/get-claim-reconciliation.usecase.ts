import { ClaimReconciliation } from '../../domain/entities/claim_reconciliation.js';
import { IClaimReconciliationRepository } from '../../infrastructure/database/repositories/claim_reconciliation.pg-repository.js';

export class GetClaimReconciliationUseCase {
  constructor(private repository: IClaimReconciliationRepository) {}

  async execute(principal: any, id: string): Promise<ClaimReconciliation> {
    if (!principal.tenantId) {
      throw new Error('Forbidden: Tenant context is required');
    }

    if (!principal.roles?.includes('admin') && !principal.permissions?.includes('claim_reconciliation:read')) {
      throw new Error('Forbidden: Insufficient permissions to read claim reconciliation');
    }

    const reconciliation = await this.repository.findById(id, principal.tenantId);
    if (!reconciliation) {
      throw new Error(`ClaimReconciliation with ID ${id} not found`);
    }

    return reconciliation;
  }
}
