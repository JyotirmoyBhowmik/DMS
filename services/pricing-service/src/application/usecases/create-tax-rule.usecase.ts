import { TaxRule, TaxCode } from '../../domain/entities/tax_rule.js';
import { TaxRulePgRepository } from '../../infrastructure/database/repositories/tax_rule.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { CreateTaxRuleDTO } from '@dms/pkg-validation';
import { randomUUID } from 'node:crypto';

export class CreateTaxRuleUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });
  private static idempotencyStore = new Map<string, TaxRule>();

  constructor(private ruleRepo: TaxRulePgRepository) {}

  async execute(
    principal: Principal,
    dto: CreateTaxRuleDTO,
    idempotencyKey?: string
  ): Promise<TaxRule> {
    // 1. Authorize inside use case
    if (!RbacGuard.can(principal, 'tax_rule:create')) {
      throw new Error('Forbidden: Insufficient permissions to create tax rule');
    }

    // 2. Idempotency Key check
    if (idempotencyKey) {
      const cached = CreateTaxRuleUseCase.idempotencyStore.get(`${principal.tenantId}:${idempotencyKey}`);
      if (cached) {
        return cached;
      }
    }

    // 3. Uniqueness Check: Check tax code per tenant
    const existing = await this.ruleRepo.findByCode(principal.tenantId, dto.taxCode as TaxCode);
    if (existing) {
      throw new Error(`409 Conflict: Tax rule with code ${dto.taxCode} already exists`);
    }

    // 4. Construct aggregate
    const ruleId = randomUUID();
    const rule = TaxRule.create({
      id: ruleId,
      tenantId: principal.tenantId,
      name: dto.name,
      taxCode: dto.taxCode as TaxCode,
      ratePercentage: dto.ratePercentage,
    });

    // 5. Persist to repository
    await this.ruleRepo.save(rule);

    // 6. Outbox event publication
    const eventEnvelope = makeEnvelope(
      'pricing.tax_rule.created',
      'v1',
      {
        ruleId: rule.id,
        name: rule.name,
        taxCode: rule.taxCode,
        ratePercentage: rule.ratePercentage,
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
        'TaxRule',
        rule.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    if (idempotencyKey) {
      CreateTaxRuleUseCase.idempotencyStore.set(`${principal.tenantId}:${idempotencyKey}`, rule);
    }

    return rule;
  }
}
