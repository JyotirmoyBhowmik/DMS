import { SchemePromotion, PromotionType } from '../../domain/entities/scheme_promotion.js';
import { SchemePromotionPgRepository } from '../../infrastructure/database/repositories/scheme_promotion.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { CreateSchemePromotionDTO } from '@dms/pkg-validation';
import { randomUUID } from 'node:crypto';

export class CreateSchemePromotionUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });
  private static idempotencyStore = new Map<string, SchemePromotion>();

  constructor(private promoRepo: SchemePromotionPgRepository) {}

  async execute(
    principal: Principal,
    dto: CreateSchemePromotionDTO,
    idempotencyKey?: string
  ): Promise<SchemePromotion> {
    // 1. Authorize inside use case
    if (!RbacGuard.can(principal, 'scheme_promotion:create')) {
      throw new Error('Forbidden: Insufficient permissions to create scheme promotion');
    }

    // 2. Idempotency Key check
    if (idempotencyKey) {
      const cached = CreateSchemePromotionUseCase.idempotencyStore.get(`${principal.tenantId}:${idempotencyKey}`);
      if (cached) {
        return cached;
      }
    }

    // 3. Uniqueness Check: Check promoCode per tenant
    const existing = await this.promoRepo.findByCode(principal.tenantId, dto.promoCode);
    if (existing) {
      throw new Error(`409 Conflict: SchemePromotion with code ${dto.promoCode} already exists`);
    }

    // 4. Construct aggregate
    const promoId = randomUUID();
    const promo = SchemePromotion.create({
      id: promoId,
      tenantId: principal.tenantId,
      schemeId: dto.schemeId,
      name: dto.name,
      promoCode: dto.promoCode,
      promotionType: dto.promotionType as PromotionType,
      discountPercentage: dto.discountPercentage,
      maxDiscountCents: dto.maxDiscountCents,
    });

    // 5. Persist to repository
    await this.promoRepo.save(promo);

    // 6. Outbox event publication
    const eventEnvelope = makeEnvelope(
      'schemes.scheme_promotion.created',
      'v1',
      {
        promoId: promo.id,
        schemeId: promo.schemeId,
        name: promo.name,
        promoCode: promo.promoCode,
        promotionType: promo.promotionType,
        status: promo.status,
      },
      {
        tenantId: principal.tenantId,
        correlationId: principal.id,
        producer: 'schemes-service',
        partitionKey: promo.id,
      }
    );

    try {
      await this.outboxRepo.save(
        null as any,
        {
          eventId: eventEnvelope.eventId,
          tenantId: promo.tenantId,
          type: eventEnvelope.type,
          version: 'v1',
          payload: eventEnvelope.payload,
        },
        'SchemePromotion',
        promo.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    if (idempotencyKey) {
      CreateSchemePromotionUseCase.idempotencyStore.set(`${principal.tenantId}:${idempotencyKey}`, promo);
    }

    return promo;
  }
}
