import { Settlement } from '../../domain/entities/settlement.js';
import { ISettlementRepository } from '../../infrastructure/database/repositories/settlement.pg-repository.js';
import { QuerySettlementInput } from '@dms/pkg-validation';

export class ListSettlementsUseCase {
  constructor(private repository: ISettlementRepository) {}

  async execute(
    principal: any,
    query: QuerySettlementInput
  ): Promise<{ data: Settlement[]; total: number; page: number; limit: number }> {
    if (!principal.tenantId) {
      throw new Error('Forbidden: Tenant context is required');
    }

    if (!principal.roles?.includes('admin') && !principal.permissions?.includes('settlement:read')) {
      throw new Error('Forbidden: Insufficient permissions to list settlements');
    }

    const { status, claimId, distributorId, page, limit } = query;
    const result = await this.repository.list(
      principal.tenantId,
      { status, claimId, distributorId },
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
