import { SchemeClaim } from '../../domain/entities/scheme_claim.js';
import { ISchemeClaimRepository } from '../../infrastructure/database/repositories/scheme_claim.pg-repository.js';

export class GetSchemeClaimUseCase {
  constructor(private repository: ISchemeClaimRepository) {}

  async execute(principal: any, id: string): Promise<SchemeClaim> {
    if (!principal.tenantId) {
      throw new Error('Forbidden: Tenant context is required');
    }

    if (!principal.roles?.includes('admin') && !principal.permissions?.includes('scheme_claim:read')) {
      throw new Error('Forbidden: Insufficient permissions to read scheme claim');
    }

    const claim = await this.repository.findById(id, principal.tenantId);
    if (!claim) {
      throw new Error(`SchemeClaim with ID ${id} not found`);
    }

    return claim;
  }
}
