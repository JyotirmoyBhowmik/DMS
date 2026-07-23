import { SchemeClaim } from '../../domain/entities/scheme_claim.js';
import { ISchemeClaimRepository } from '../../infrastructure/database/repositories/scheme_claim.pg-repository.js';
import { QuerySchemeClaimInput } from '@dms/pkg-validation';

export class ListSchemeClaimsUseCase {
  constructor(private repository: ISchemeClaimRepository) {}

  async execute(
    principal: any,
    query: QuerySchemeClaimInput
  ): Promise<{ data: SchemeClaim[]; total: number; page: number; limit: number }> {
    if (!principal.tenantId) {
      throw new Error('Forbidden: Tenant context is required');
    }

    if (!principal.roles?.includes('admin') && !principal.permissions?.includes('scheme_claim:read')) {
      throw new Error('Forbidden: Insufficient permissions to list scheme claims');
    }

    const { status, schemeId, distributorId, page, limit } = query;
    const result = await this.repository.list(
      principal.tenantId,
      { status, schemeId, distributorId },
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
