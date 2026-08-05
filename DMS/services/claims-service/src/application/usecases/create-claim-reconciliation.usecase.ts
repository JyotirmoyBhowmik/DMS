import { ClaimReconciliation } from '../../domain/entities/claim_reconciliation.js';
import { IClaimReconciliationRepository } from '../../infrastructure/database/repositories/claim_reconciliation.pg-repository.js';
import { CreateClaimReconciliationInput } from '@dms/pkg-validation';
import { StructuredLogger } from '@dms/pkg-logger';

export class CreateClaimReconciliationUseCase {
  private logger = new StructuredLogger('CreateClaimReconciliationUseCase');
  private idempotencyCache = new Map<string, ClaimReconciliation>();

  constructor(private repository: IClaimReconciliationRepository) {}

  async execute(principal: any, input: CreateClaimReconciliationInput, idempotencyKey?: string): Promise<ClaimReconciliation> {
    if (!principal.tenantId) {
      throw new Error('Forbidden: Tenant context is required');
    }

    if (!principal.roles?.includes('admin') && !principal.permissions?.includes('claim_reconciliation:create')) {
      throw new Error('Forbidden: Insufficient permissions to create claim reconciliation');
    }

    if (idempotencyKey && this.idempotencyCache.has(idempotencyKey)) {
      this.logger.info(`Idempotent hit for key ${idempotencyKey}`);
      return this.idempotencyCache.get(idempotencyKey)!;
    }

    const existing = await this.repository.findByCode(input.reconciliationCode, principal.tenantId);
    if (existing) {
      throw new Error(`Conflict: ClaimReconciliation with code ${input.reconciliationCode} already exists`);
    }

    const reconciliation = new ClaimReconciliation({
      id: input.id,
      tenantId: principal.tenantId,
      reconciliationCode: input.reconciliationCode,
      distributorId: input.distributorId,
      totalClaimedCents: input.totalClaimedCents,
      totalSettledCents: input.totalSettledCents,
      status: input.status,
    });

    await this.repository.save(reconciliation, principal.tenantId);

    if (idempotencyKey) {
      this.idempotencyCache.set(idempotencyKey, reconciliation);
    }

    this.logger.info(`Created ClaimReconciliation ${reconciliation.id} for tenant ${principal.tenantId}`);
    return reconciliation;
  }
}
