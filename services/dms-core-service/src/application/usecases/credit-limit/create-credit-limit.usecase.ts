import { CreditLimit } from '../../../domain/entities/credit-limit.js';
import { CreditLimitPgRepository } from '../../../infrastructure/database/repositories/credit-limit.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { CreateCreditLimitDTO } from '@dms/pkg-validation';
import { randomUUID } from 'node:crypto';

export class CreateCreditLimitUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });
  private static idempotencyStore = new Map<string, CreditLimit>();

  constructor(private creditLimitRepo: CreditLimitPgRepository) {}

  async execute(
    principal: Principal,
    dto: CreateCreditLimitDTO,
    idempotencyKey?: string
  ): Promise<CreditLimit> {
    // 1. Authorize inside use case
    if (!RbacGuard.can(principal, 'credit_limit:create')) {
      throw new Error('Forbidden: Insufficient permissions to create credit limit');
    }

    // 2. Idempotency Key check
    if (idempotencyKey) {
      const cached = CreateCreditLimitUseCase.idempotencyStore.get(`${principal.tenantId}:${idempotencyKey}`);
      if (cached) {
        return cached;
      }
    }

    // 3. Uniqueness Check: Check if distributor already has a credit limit
    const existing = await this.creditLimitRepo.findByDistributor(principal.tenantId, dto.distributorId);
    if (existing) {
      throw new Error(`409 Conflict: Credit limit already configured for distributor ${dto.distributorId}`);
    }

    // 4. Construct aggregate
    const clId = randomUUID();
    const cl = CreditLimit.create({
      id: clId,
      tenantId: principal.tenantId,
      distributorId: dto.distributorId,
      creditLimit: dto.creditLimit,
      creditRating: dto.creditRating as any,
      paymentTermDays: dto.paymentTermDays,
    });

    // 5. Persist to repository
    await this.creditLimitRepo.save(cl);

    // 6. Outbox event publication
    const eventEnvelope = makeEnvelope(
      'distributor.credit_limit.created',
      'v1',
      {
        creditLimitId: cl.id,
        distributorId: cl.distributorId,
        creditLimit: cl.creditLimit,
        creditRating: cl.creditRating,
      },
      {
        tenantId: principal.tenantId,
        correlationId: principal.id,
        producer: 'dms-core-service',
        partitionKey: cl.id,
      }
    );

    try {
      await this.outboxRepo.save(
        null as any,
        {
          eventId: eventEnvelope.eventId,
          tenantId: cl.tenantId,
          type: eventEnvelope.type,
          version: 'v1',
          payload: eventEnvelope.payload,
        },
        'CreditLimit',
        cl.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    if (idempotencyKey) {
      CreateCreditLimitUseCase.idempotencyStore.set(`${principal.tenantId}:${idempotencyKey}`, cl);
    }

    return cl;
  }
}
