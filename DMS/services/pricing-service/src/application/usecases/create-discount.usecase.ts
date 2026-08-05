import { Discount, DiscountType } from '../../domain/entities/discount.js';
import { DiscountPgRepository } from '../../infrastructure/database/repositories/discount.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { CreateDiscountDTO } from '@dms/pkg-validation';
import { randomUUID } from 'node:crypto';

export class CreateDiscountUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });
  private static idempotencyStore = new Map<string, Discount>();

  constructor(private discountRepo: DiscountPgRepository) {}

  async execute(
    principal: Principal,
    dto: CreateDiscountDTO,
    idempotencyKey?: string
  ): Promise<Discount> {
    // 1. Authorize inside use case
    if (!RbacGuard.can(principal, 'discount:create')) {
      throw new Error('Forbidden: Insufficient permissions to create discount');
    }

    // 2. Idempotency Key check
    if (idempotencyKey) {
      const cached = CreateDiscountUseCase.idempotencyStore.get(`${principal.tenantId}:${idempotencyKey}`);
      if (cached) {
        return cached;
      }
    }

    // 3. Uniqueness Check: Check code per tenant
    const existing = await this.discountRepo.findByCode(principal.tenantId, dto.code);
    if (existing) {
      throw new Error(`409 Conflict: Discount with code ${dto.code} already exists`);
    }

    // 4. Construct aggregate
    const discountId = randomUUID();
    const discount = Discount.create({
      id: discountId,
      tenantId: principal.tenantId,
      name: dto.name,
      code: dto.code,
      discountType: dto.discountType as DiscountType,
      value: dto.value,
      minOrderAmountCents: dto.minOrderAmountCents ?? 0,
    });

    // 5. Persist to repository
    await this.discountRepo.save(discount);

    // 6. Outbox event publication
    const eventEnvelope = makeEnvelope(
      'pricing.discount.created',
      'v1',
      {
        discountId: discount.id,
        name: discount.name,
        code: discount.code,
        discountType: discount.discountType,
        value: discount.value,
        status: discount.status,
      },
      {
        tenantId: principal.tenantId,
        correlationId: principal.id,
        producer: 'pricing-service',
        partitionKey: discount.id,
      }
    );

    try {
      await this.outboxRepo.save(
        null as any,
        {
          eventId: eventEnvelope.eventId,
          tenantId: discount.tenantId,
          type: eventEnvelope.type,
          version: 'v1',
          payload: eventEnvelope.payload,
        },
        'Discount',
        discount.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    if (idempotencyKey) {
      CreateDiscountUseCase.idempotencyStore.set(`${principal.tenantId}:${idempotencyKey}`, discount);
    }

    return discount;
  }
}
