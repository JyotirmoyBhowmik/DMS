import { Settlement } from '../../domain/entities/settlement.js';
import { ISettlementRepository } from '../../infrastructure/database/repositories/settlement.pg-repository.js';
import { CreateSettlementInput } from '@dms/pkg-validation';
import { StructuredLogger } from '@dms/pkg-logger';

export class CreateSettlementUseCase {
  private logger = new StructuredLogger('CreateSettlementUseCase');
  private idempotencyCache = new Map<string, Settlement>();

  constructor(private repository: ISettlementRepository) {}

  async execute(principal: any, input: CreateSettlementInput, idempotencyKey?: string): Promise<Settlement> {
    if (!principal.tenantId) {
      throw new Error('Forbidden: Tenant context is required');
    }

    if (!principal.roles?.includes('admin') && !principal.permissions?.includes('settlement:create')) {
      throw new Error('Forbidden: Insufficient permissions to create settlement');
    }

    if (idempotencyKey && this.idempotencyCache.has(idempotencyKey)) {
      this.logger.info(`Idempotent hit for key ${idempotencyKey}`);
      return this.idempotencyCache.get(idempotencyKey)!;
    }

    const existing = await this.repository.findByCode(input.settlementCode, principal.tenantId);
    if (existing) {
      throw new Error(`Conflict: Settlement with code ${input.settlementCode} already exists`);
    }

    const settlement = new Settlement({
      id: input.id,
      tenantId: principal.tenantId,
      settlementCode: input.settlementCode,
      claimId: input.claimId,
      distributorId: input.distributorId,
      amountCents: input.amountCents,
      paymentReference: input.paymentReference,
      status: input.status,
    });

    await this.repository.save(settlement, principal.tenantId);

    if (idempotencyKey) {
      this.idempotencyCache.set(idempotencyKey, settlement);
    }

    this.logger.info(`Created Settlement ${settlement.id} for tenant ${principal.tenantId}`);
    return settlement;
  }
}
