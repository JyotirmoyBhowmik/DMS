import { SchemePayout, PayoutType } from '../../domain/entities/scheme_payout.js';
import { SchemePayoutPgRepository } from '../../infrastructure/database/repositories/scheme_payout.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { CreateSchemePayoutDTO } from '@dms/pkg-validation';
import { randomUUID } from 'node:crypto';

export class CreateSchemePayoutUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });
  private static idempotencyStore = new Map<string, SchemePayout>();

  constructor(private payoutRepo: SchemePayoutPgRepository) {}

  async execute(
    principal: Principal,
    dto: CreateSchemePayoutDTO,
    idempotencyKey?: string
  ): Promise<SchemePayout> {
    // 1. Authorize inside use case
    if (!RbacGuard.can(principal, 'scheme_payout:create')) {
      throw new Error('Forbidden: Insufficient permissions to create scheme payout');
    }

    // 2. Idempotency Key check
    if (idempotencyKey) {
      const cached = CreateSchemePayoutUseCase.idempotencyStore.get(`${principal.tenantId}:${idempotencyKey}`);
      if (cached) {
        return cached;
      }
    }

    // 3. Uniqueness Check: Check payoutCode per scheme
    const existing = await this.payoutRepo.findByCode(principal.tenantId, dto.schemeId, dto.payoutCode);
    if (existing) {
      throw new Error(`409 Conflict: SchemePayout with code ${dto.payoutCode} already exists for this scheme`);
    }

    // 4. Construct aggregate
    const payoutId = randomUUID();
    const payout = SchemePayout.create({
      id: payoutId,
      tenantId: principal.tenantId,
      schemeId: dto.schemeId,
      distributorId: dto.distributorId,
      claimId: dto.claimId,
      name: dto.name,
      payoutCode: dto.payoutCode,
      amountCents: dto.amountCents,
      payoutType: dto.payoutType as PayoutType,
    });

    // 5. Persist to repository
    await this.payoutRepo.save(payout);

    // 6. Outbox event publication
    const eventEnvelope = makeEnvelope(
      'schemes.scheme_payout.created',
      'v1',
      {
        payoutId: payout.id,
        schemeId: payout.schemeId,
        distributorId: payout.distributorId,
        name: payout.name,
        payoutCode: payout.payoutCode,
        amountCents: payout.amountCents,
        payoutType: payout.payoutType,
        status: payout.status,
      },
      {
        tenantId: principal.tenantId,
        correlationId: principal.id,
        producer: 'schemes-service',
        partitionKey: payout.id,
      }
    );

    try {
      await this.outboxRepo.save(
        null as any,
        {
          eventId: eventEnvelope.eventId,
          tenantId: payout.tenantId,
          type: eventEnvelope.type,
          version: 'v1',
          payload: eventEnvelope.payload,
        },
        'SchemePayout',
        payout.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    if (idempotencyKey) {
      CreateSchemePayoutUseCase.idempotencyStore.set(`${principal.tenantId}:${idempotencyKey}`, payout);
    }

    return payout;
  }
}
