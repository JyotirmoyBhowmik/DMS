import { ChannelPriceRule, ChannelCode } from '../../domain/entities/channel_price_rule.js';
import { ChannelPriceRulePgRepository } from '../../infrastructure/database/repositories/channel_price_rule.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { CreateChannelPriceRuleDTO } from '@dms/pkg-validation';
import { randomUUID } from 'node:crypto';

export class CreateChannelPriceRuleUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });
  private static idempotencyStore = new Map<string, ChannelPriceRule>();

  constructor(private ruleRepo: ChannelPriceRulePgRepository) {}

  async execute(
    principal: Principal,
    dto: CreateChannelPriceRuleDTO,
    idempotencyKey?: string
  ): Promise<ChannelPriceRule> {
    // 1. Authorize inside use case
    if (!RbacGuard.can(principal, 'channel_price_rule:create')) {
      throw new Error('Forbidden: Insufficient permissions to create channel price rule');
    }

    // 2. Idempotency Key check
    if (idempotencyKey) {
      const cached = CreateChannelPriceRuleUseCase.idempotencyStore.get(`${principal.tenantId}:${idempotencyKey}`);
      if (cached) {
        return cached;
      }
    }

    // 3. Uniqueness Check: Check channel per price list & tenant
    const existing = await this.ruleRepo.findByChannel(principal.tenantId, dto.priceListId, dto.channelCode as ChannelCode);
    if (existing) {
      throw new Error(`409 Conflict: Channel price rule for channel ${dto.channelCode} already exists on list ${dto.priceListId}`);
    }

    // 4. Construct aggregate
    const ruleId = randomUUID();
    const rule = ChannelPriceRule.create({
      id: ruleId,
      tenantId: principal.tenantId,
      priceListId: dto.priceListId,
      channelCode: dto.channelCode as ChannelCode,
      multiplier: dto.multiplier ?? 1.0,
      priceAdjustmentCents: dto.priceAdjustmentCents ?? 0,
    });

    // 5. Persist to repository
    await this.ruleRepo.save(rule);

    // 6. Outbox event publication
    const eventEnvelope = makeEnvelope(
      'pricing.channel_price_rule.created',
      'v1',
      {
        ruleId: rule.id,
        priceListId: rule.priceListId,
        channelCode: rule.channelCode,
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
        'ChannelPriceRule',
        rule.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    if (idempotencyKey) {
      CreateChannelPriceRuleUseCase.idempotencyStore.set(`${principal.tenantId}:${idempotencyKey}`, rule);
    }

    return rule;
  }
}
