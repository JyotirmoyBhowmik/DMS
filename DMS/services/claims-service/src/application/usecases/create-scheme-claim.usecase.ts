import { SchemeClaim } from '../../domain/entities/scheme_claim.js';
import { ISchemeClaimRepository } from '../../infrastructure/database/repositories/scheme_claim.pg-repository.js';
import { CreateSchemeClaimInput } from '@dms/pkg-validation';
import { StructuredLogger } from '@dms/pkg-logger';

export class CreateSchemeClaimUseCase {
  private logger = new StructuredLogger('CreateSchemeClaimUseCase');
  private idempotencyCache = new Map<string, SchemeClaim>();

  constructor(private repository: ISchemeClaimRepository) {}

  async execute(principal: any, input: CreateSchemeClaimInput, idempotencyKey?: string): Promise<SchemeClaim> {
    if (!principal.tenantId) {
      throw new Error('Forbidden: Tenant context is required');
    }

    if (!principal.roles?.includes('admin') && !principal.permissions?.includes('scheme_claim:create')) {
      throw new Error('Forbidden: Insufficient permissions to create scheme claim');
    }

    if (idempotencyKey && this.idempotencyCache.has(idempotencyKey)) {
      this.logger.info(`Idempotent hit for key ${idempotencyKey}`);
      return this.idempotencyCache.get(idempotencyKey)!;
    }

    const existing = await this.repository.findByCode(input.claimCode, principal.tenantId);
    if (existing) {
      throw new Error(`Conflict: SchemeClaim with code ${input.claimCode} already exists`);
    }

    const claim = new SchemeClaim({
      id: input.id,
      tenantId: principal.tenantId,
      claimCode: input.claimCode,
      schemeId: input.schemeId,
      distributorId: input.distributorId,
      claimAmountCents: input.claimAmountCents,
      approvedAmountCents: input.approvedAmountCents,
      status: input.status,
    });

    await this.repository.save(claim, principal.tenantId);

    if (idempotencyKey) {
      this.idempotencyCache.set(idempotencyKey, claim);
    }

    this.logger.info(`Created SchemeClaim ${claim.id} for tenant ${principal.tenantId}`);
    return claim;
  }
}
