import { Replacement } from '../../../domain/entities/replacement.js';
import { ReplacementPgRepository } from '../../../infrastructure/database/repositories/replacement.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { CreateReplacementDTO } from '@dms/pkg-validation';
import { randomUUID } from 'node:crypto';

export class CreateReplacementUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });
  private static idempotencyStore = new Map<string, Replacement>();

  constructor(private repRepo: ReplacementPgRepository) {}

  async execute(
    principal: Principal,
    dto: CreateReplacementDTO,
    idempotencyKey?: string
  ): Promise<Replacement> {
    // 1. Authorize inside use case
    if (!RbacGuard.can(principal, 'replacement:create')) {
      throw new Error('Forbidden: Insufficient permissions to create replacement');
    }

    // 2. Idempotency Key check
    if (idempotencyKey) {
      const cached = CreateReplacementUseCase.idempotencyStore.get(`${principal.tenantId}:${idempotencyKey}`);
      if (cached) {
        return cached;
      }
    }

    // 3. Uniqueness Check: Check replacementNumber per tenant
    const existing = await this.repRepo.findByReplacementNumber(principal.tenantId, dto.replacementNumber);
    if (existing) {
      throw new Error(`409 Conflict: Replacement request with number ${dto.replacementNumber} already exists`);
    }

    // 4. Construct aggregate
    const replacementId = randomUUID();
    const rep = Replacement.create({
      id: replacementId,
      tenantId: principal.tenantId,
      replacementNumber: dto.replacementNumber,
      returnId: dto.returnId,
      outletId: dto.outletId,
      warehouseId: dto.warehouseId,
      skuId: dto.skuId,
      quantity: dto.quantity,
    });

    // 5. Persist to repository
    await this.repRepo.save(rep);

    // 6. Outbox event publication
    const eventEnvelope = makeEnvelope(
      'distributor.replacement.created',
      'v1',
      {
        replacementId: rep.id,
        replacementNumber: rep.replacementNumber,
        returnId: rep.returnId,
        outletId: rep.outletId,
        warehouseId: rep.warehouseId,
        skuId: rep.skuId,
        quantity: rep.quantity,
        status: rep.status,
      },
      {
        tenantId: principal.tenantId,
        correlationId: principal.id,
        producer: 'dms-core-service',
        partitionKey: rep.id,
      }
    );

    try {
      await this.outboxRepo.save(
        null as any,
        {
          eventId: eventEnvelope.eventId,
          tenantId: rep.tenantId,
          type: eventEnvelope.type,
          version: 'v1',
          payload: eventEnvelope.payload,
        },
        'Replacement',
        rep.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    if (idempotencyKey) {
      CreateReplacementUseCase.idempotencyStore.set(`${principal.tenantId}:${idempotencyKey}`, rep);
    }

    return rep;
  }
}
