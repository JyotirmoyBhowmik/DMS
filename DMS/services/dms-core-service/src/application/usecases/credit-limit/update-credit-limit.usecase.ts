import { CreditLimit } from '../../../domain/entities/credit-limit.js';
import { CreditLimitPgRepository } from '../../../infrastructure/database/repositories/credit-limit.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { UpdateCreditLimitDTO, UtilizeCreditDTO } from '@dms/pkg-validation';

export class UpdateCreditLimitUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });

  constructor(private creditLimitRepo: CreditLimitPgRepository) {}

  async execute(
    principal: Principal,
    id: string,
    dto: UpdateCreditLimitDTO
  ): Promise<CreditLimit> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'credit_limit:update')) {
      throw new Error('Forbidden: Insufficient permissions to update credit limit');
    }

    // 2. Fetch existing entity
    const existing = await this.creditLimitRepo.findById(principal.tenantId, id);
    if (!existing || existing.tenantId !== principal.tenantId) {
      throw new Error(`CreditLimit with ID ${id} not found`);
    }

    // 3. Optimistic locking check
    if (dto.version !== undefined && existing.version !== dto.version) {
      throw new Error('409 Conflict: Optimistic locking failure, version mismatch');
    }

    // 4. Apply domain mutations
    if (dto.creditLimit !== undefined) {
      existing.updateLimit(dto.creditLimit);
    }
    if (dto.creditRating) {
      existing.updateCreditRating(dto.creditRating as any);
    }
    if (dto.paymentTermDays) {
      existing.updatePaymentTerms(dto.paymentTermDays);
    }
    if (dto.temporaryLimitIncrease !== undefined && dto.temporaryLimitExpiry) {
      existing.setTemporaryIncrease(dto.temporaryLimitIncrease, dto.temporaryLimitExpiry);
    }

    // 5. Persist updated aggregate
    await this.creditLimitRepo.save(existing);

    // 6. Record outbox event
    const eventEnvelope = makeEnvelope(
      'distributor.credit_limit.updated',
      'v1',
      {
        creditLimitId: existing.id,
        distributorId: existing.distributorId,
        creditLimit: existing.creditLimit,
        utilizedAmount: existing.utilizedAmount,
        availableAmount: existing.availableAmount,
        isOnCreditHold: existing.isOnCreditHold,
        version: existing.version,
      },
      {
        tenantId: principal.tenantId,
        correlationId: principal.id,
        producer: 'dms-core-service',
        partitionKey: existing.id,
      }
    );

    try {
      await this.outboxRepo.save(
        null as any,
        {
          eventId: eventEnvelope.eventId,
          tenantId: existing.tenantId,
          type: eventEnvelope.type,
          version: 'v1',
          payload: eventEnvelope.payload,
        },
        'CreditLimit',
        existing.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    return existing;
  }

  async utilize(
    principal: Principal,
    id: string,
    dto: UtilizeCreditDTO
  ): Promise<CreditLimit> {
    if (!RbacGuard.can(principal, 'credit_limit:update')) {
      throw new Error('Forbidden: Insufficient permissions to utilize credit');
    }

    const existing = await this.creditLimitRepo.findById(principal.tenantId, id);
    if (!existing || existing.tenantId !== principal.tenantId) {
      throw new Error(`CreditLimit with ID ${id} not found`);
    }

    if (dto.version !== undefined && existing.version !== dto.version) {
      throw new Error('409 Conflict: Optimistic locking failure, version mismatch');
    }

    existing.utilize(dto.amount);
    await this.creditLimitRepo.save(existing);
    return existing;
  }
}
