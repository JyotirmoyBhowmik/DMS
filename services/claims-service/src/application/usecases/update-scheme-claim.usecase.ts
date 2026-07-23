import { SchemeClaim } from '../../domain/entities/scheme_claim.js';
import { ISchemeClaimRepository } from '../../infrastructure/database/repositories/scheme_claim.pg-repository.js';
import { UpdateSchemeClaimInput } from '@dms/pkg-validation';
import { StructuredLogger } from '@dms/pkg-logger';

export class UpdateSchemeClaimUseCase {
  private logger = new StructuredLogger('UpdateSchemeClaimUseCase');

  constructor(private repository: ISchemeClaimRepository) {}

  async execute(principal: any, id: string, input: UpdateSchemeClaimInput): Promise<SchemeClaim> {
    if (!principal.tenantId) {
      throw new Error('Forbidden: Tenant context is required');
    }

    if (!principal.roles?.includes('admin') && !principal.permissions?.includes('scheme_claim:update')) {
      throw new Error('Forbidden: Insufficient permissions to update scheme claim');
    }

    const existing = await this.repository.findById(id, principal.tenantId);
    if (!existing) {
      throw new Error(`SchemeClaim with ID ${id} not found`);
    }

    if (input.status) {
      existing.updateStatus(input.status, input.approvedAmountCents);
    }

    const updated = await this.repository.update(existing, principal.tenantId);
    this.logger.info(`Updated SchemeClaim ${id} for tenant ${principal.tenantId}`);
    return updated;
  }
}
