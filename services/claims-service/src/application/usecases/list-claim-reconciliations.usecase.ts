import { ClaimReconciliation } from '../../domain/entities/claim_reconciliation.js';
import { IClaimReconciliationRepository } from '../../infrastructure/database/repositories/claim_reconciliation.pg-repository.js';
import { QueryClaimReconciliationInput } from '@dms/pkg-validation';

export class ListClaimReconciliationsUseCase {
  constructor(private repository: IClaimReconciliationRepository) {}

  async execute(
    principal: any,
    query: QueryClaimReconciliationInput
  ): Promise<{ data: ClaimReconciliation[]; total: number; page: number; limit: number }> {
    if (!principal.tenantId) {
      throw new Error('Forbidden: Tenant context is required');
    }

    if (!principal.roles?.includes('admin') && !principal.permissions?.includes('claim_reconciliation:read')) {
      throw new Error('Forbidden: Insufficient permissions to list claim reconciliations');
    }

    const { status, distributorId, page, limit } = query;
    const result = await this.repository.list(
      principal.tenantId,
      { status, distributorId },
      { page, limit }
    );

    return {
      data: result.data,
      total: result.total,
      page,
      limit,
    };
  }
}
