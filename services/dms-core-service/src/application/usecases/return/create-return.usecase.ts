import { ReturnEntity } from '../../../domain/entities/return.js';
import { ReturnPgRepository } from '../../../infrastructure/database/repositories/return.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { CreateReturnDTO } from '@dms/pkg-validation';
import { randomUUID } from 'node:crypto';

export class CreateReturnUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });
  private static idempotencyStore = new Map<string, ReturnEntity>();

  constructor(private returnRepo: ReturnPgRepository) {}

  async execute(
    principal: Principal,
    dto: CreateReturnDTO,
    idempotencyKey?: string
  ): Promise<ReturnEntity> {
    // 1. Authorize inside use case
    if (!RbacGuard.can(principal, 'return:create')) {
      throw new Error('Forbidden: Insufficient permissions to create return');
    }

    // 2. Idempotency Key check
    if (idempotencyKey) {
      const cached = CreateReturnUseCase.idempotencyStore.get(`${principal.tenantId}:${idempotencyKey}`);
      if (cached) {
        return cached;
      }
    }

    // 3. Uniqueness Check: Check returnNumber per tenant
    const existing = await this.returnRepo.findByReturnNumber(principal.tenantId, dto.returnNumber);
    if (existing) {
      throw new Error(`409 Conflict: Return request with number ${dto.returnNumber} already exists`);
    }

    // 4. Construct aggregate
    const returnId = randomUUID();
    const ret = ReturnEntity.create({
      id: returnId,
      tenantId: principal.tenantId,
      returnNumber: dto.returnNumber,
      outletId: dto.outletId,
      warehouseId: dto.warehouseId,
      skuId: dto.skuId,
      quantity: dto.quantity,
      reason: dto.reason,
      totalAmountCents: dto.totalAmountCents,
    });

    // 5. Persist to repository
    await this.returnRepo.save(ret);

    // 6. Outbox event publication
    const eventEnvelope = makeEnvelope(
      'distributor.return.created',
      'v1',
      {
        returnId: ret.id,
        returnNumber: ret.returnNumber,
        outletId: ret.outletId,
        warehouseId: ret.warehouseId,
        skuId: ret.skuId,
        quantity: ret.quantity,
        reason: ret.reason,
        totalAmountCents: ret.totalAmountCents,
        status: ret.status,
      },
      {
        tenantId: principal.tenantId,
        correlationId: principal.id,
        producer: 'dms-core-service',
        partitionKey: ret.id,
      }
    );

    try {
      await this.outboxRepo.save(
        null as any,
        {
          eventId: eventEnvelope.eventId,
          tenantId: ret.tenantId,
          type: eventEnvelope.type,
          version: 'v1',
          payload: eventEnvelope.payload,
        },
        'Return',
        ret.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    if (idempotencyKey) {
      CreateReturnUseCase.idempotencyStore.set(`${principal.tenantId}:${idempotencyKey}`, ret);
    }

    return ret;
  }
}
