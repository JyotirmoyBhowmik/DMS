import { EligibilityRule, RuleType } from '../../domain/entities/eligibility_rule.js';
import { EligibilityRulePgRepository } from '../../infrastructure/database/repositories/eligibility_rule.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { CreateEligibilityRuleDTO } from '@dms/pkg-validation';
import { randomUUID } from 'node:crypto';

export class CreateEligibilityRuleUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });
  private static idempotencyStore = new Map<string, EligibilityRule>();

  constructor(private ruleRepo: EligibilityRulePgRepository) {}

  async execute(
    principal: Principal,
    dto: CreateEligibilityRuleDTO,
    idempotencyKey?: string
  ): Promise<EligibilityRule> {
    // 1. Authorize inside use case
    if (!RbacGuard.can(principal, 'eligibility_rule:create')) {
      throw new Error('Forbidden: Insufficient permissions to create eligibility rule');
    }

    // 2. Idempotency Key check
    if (idempotencyKey) {
      const cached = CreateEligibilityRuleUseCase.idempotencyStore.get(`${principal.tenantId}:${idempotencyKey}`);
      if (cached) {
        return cached;
      }
    }

    // 3. Uniqueness Check: Check ruleCode per scheme
    const existing = await this.ruleRepo.findByCode(principal.tenantId, dto.schemeId, dto.ruleCode);
    if (existing) {
      throw new Error(`409 Conflict: EligibilityRule with code ${dto.ruleCode} already exists for this scheme`);
    }

    // 4. Construct aggregate
    const ruleId = randomUUID();
    const rule = EligibilityRule.create({
      id: ruleId,
      tenantId: principal.tenantId,
      schemeId: dto.schemeId,
      name: dto.name,
      ruleCode: dto.ruleCode,
      ruleType: dto.ruleType as RuleType,
      minOrderValueCents: dto.minOrderValueCents,
      targetValue: dto.targetValue,
    });

    // 5. Persist to repository
    await this.ruleRepo.save(rule);

    // 6. Outbox event publication
    const eventEnvelope = makeEnvelope(
      'schemes.eligibility_rule.created',
      'v1',
      {
        ruleId: rule.id,
        schemeId: rule.schemeId,
        name: rule.name,
        ruleCode: rule.ruleCode,
        ruleType: rule.ruleType,
        status: rule.status,
      },
      {
        tenantId: principal.tenantId,
        correlationId: principal.id,
        producer: 'schemes-service',
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
        'EligibilityRule',
        rule.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    if (idempotencyKey) {
      CreateEligibilityRuleUseCase.idempotencyStore.set(`${principal.tenantId}:${idempotencyKey}`, rule);
    }

    return rule;
  }
}
