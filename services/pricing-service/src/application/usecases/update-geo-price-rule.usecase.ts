import { GeoPriceRule } from '../../domain/entities/geo_price_rule.js';
import { GeoPriceRulePgRepository } from '../../infrastructure/database/repositories/geo_price_rule.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { UpdateGeoPriceRuleDTO } from '@dms/pkg-validation';

export class UpdateGeoPriceRuleUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });

  constructor(private ruleRepo: GeoPriceRulePgRepository) {}

  async execute(
    principal: Principal,
    id: string,
    dto: UpdateGeoPriceRuleDTO
  ): Promise<GeoPriceRule> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'geo_price_rule:update')) {
      throw new Error('Forbidden: Insufficient permissions to update geo price rule');
    }

    // 2. Fetch existing entity
    const existing = await this.ruleRepo.findById(principal.tenantId, id);
    if (!existing || existing.tenantId !== principal.tenantId) {
      throw new Error(`GeoPriceRule with ID ${id} not found`);
    }

    // 3. Optimistic locking check
    if (dto.version !== undefined && existing.version !== dto.version) {
      throw new Error('409 Conflict: Optimistic locking failure, version mismatch');
    }

    // 4. Apply state transitions
    if (dto.status !== undefined) {
      existing.updateStatus(dto.status);
    }

    // 5. Persist updated aggregate
    await this.ruleRepo.save(existing);

    // 6. Record outbox event
    const eventEnvelope = makeEnvelope(
      'pricing.geo_price_rule.status_updated',
      'v1',
      {
        ruleId: existing.id,
        status: existing.status,
        version: existing.version,
      },
      {
        tenantId: principal.tenantId,
        correlationId: principal.id,
        producer: 'pricing-service',
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
        'GeoPriceRule',
        existing.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    return existing;
  }
}
