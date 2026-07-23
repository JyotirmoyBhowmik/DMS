import { ClaimReconciliation } from '../../domain/entities/claim_reconciliation.js';
import { IClaimReconciliationRepository } from '../../infrastructure/database/repositories/claim_reconciliation.pg-repository.js';
import { UpdateClaimReconciliationInput } from '@dms/pkg-validation';
import { StructuredLogger } from '@dms/pkg-logger';

export class UpdateClaimReconciliationUseCase {
  private logger = new StructuredLogger('UpdateClaimReconciliationUseCase');

  constructor(private repository: IClaimReconciliationRepository) {}

  async execute(principal: any, id: string, input: UpdateClaimReconciliationInput): Promise<ClaimReconciliation> {
    if (!principal.tenantId) {
      throw new Error('Forbidden: Tenant context is required');
    }

    if (!principal.roles?.includes('admin') && !principal.permissions?.includes('claim_reconciliation:update')) {
      throw new Error('Forbidden: Insufficient permissions to update claim reconciliation');
    }

    const existing = await this.repository.findById(id, principal.tenantId);
    if (!existing) {
      throw new Error(`ClaimReconciliation with ID ${id} not found`);
    }

    if (input.status) {
      existing.updateStatus(input.status, input.totalSettledCents);
    }

    const updated = await this.repository.update(existing, principal.tenantId);
    this.logger.info(`Updated ClaimReconciliation ${id} for tenant ${principal.tenantId}`);
    return updated;
  }
}
