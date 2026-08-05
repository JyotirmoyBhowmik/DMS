import { GeoPriceRule } from '../../domain/entities/geo_price_rule.js';
import { GeoPriceRulePgRepository } from '../../infrastructure/database/repositories/geo_price_rule.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { CreateGeoPriceRuleDTO } from '@dms/pkg-validation';
import { randomUUID } from 'node:crypto';

export class CreateGeoPriceRuleUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });
  private static idempotencyStore = new Map<string, GeoPriceRule>();

  constructor(private ruleRepo: GeoPriceRulePgRepository) {}

  async execute(
    principal: Principal,
    dto: CreateGeoPriceRuleDTO,
    idempotencyKey?: string
  ): Promise<GeoPriceRule> {
    // 1. Authorize inside use case
    if (!RbacGuard.can(principal, 'geo_price_rule:create')) {
      throw new Error('Forbidden: Insufficient permissions to create geo price rule');
    }

    // 2. Idempotency Key check
    if (idempotencyKey) {
      const cached = CreateGeoPriceRuleUseCase.idempotencyStore.get(`${principal.tenantId}:${idempotencyKey}`);
      if (cached) {
        return cached;
      }
    }

    // 3. Uniqueness Check: Check region per price list & tenant
    const existing = await this.ruleRepo.findByRegion(principal.tenantId, dto.priceListId, dto.regionCode);
    if (existing) {
      throw new Error(`409 Conflict: Geo price rule for region ${dto.regionCode} already exists on list ${dto.priceListId}`);
    }

    // 4. Construct aggregate
    const ruleId = randomUUID();
    const rule = GeoPriceRule.create({
      id: ruleId,
      tenantId: principal.tenantId,
      priceListId: dto.priceListId,
      regionCode: dto.regionCode,
      multiplier: dto.multiplier ?? 1.0,
      priceAdjustmentCents: dto.priceAdjustmentCents ?? 0,
    });

    // 5. Persist to repository
    await this.ruleRepo.save(rule);

    // 6. Outbox event publication
    const eventEnvelope = makeEnvelope(
      'pricing.geo_price_rule.created',
      'v1',
      {
        ruleId: rule.id,
        priceListId: rule.priceListId,
        regionCode: rule.regionCode,
        multiplier: rule.multiplier,
        priceAdjustmentCents: rule.priceAdjustmentCents,
        status: rule.status,
      },
      {
        tenantId: principal.tenantId,
        correlationId: principal.id,
        producer: 'pricing-service',
        partitionKey: rule.id,
      }
    );

    try {
      await this.outboxRepo.save(
        null as any,
        {
          eventId: eventEnvelope.eventId,
          tenantId: rule.tenantId,
          type: eventEnvelope.type,
          version: 'v1',
          payload: eventEnvelope.payload,
        },
        'GeoPriceRule',
        rule.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    if (idempotencyKey) {
      CreateGeoPriceRuleUseCase.idempotencyStore.set(`${principal.tenantId}:${idempotencyKey}`, rule);
    }

    return rule;
  }
}
