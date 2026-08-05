import { Claim } from '../../domain/entities/claim.js';
import { ClaimPgRepository } from '../../infrastructure/database/repositories/claim.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { CreateClaimDTO } from '@dms/pkg-validation';
import { randomUUID } from 'node:crypto';

export class CreateClaimUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });
  private static idempotencyStore = new Map<string, Claim>();

  constructor(private claimRepo: ClaimPgRepository) {}

  async execute(
    principal: Principal,
    dto: CreateClaimDTO,
    idempotencyKey?: string
  ): Promise<Claim> {
    // 1. Authorize inside use case
    if (!RbacGuard.can(principal, 'claim:create')) {
      throw new Error('Forbidden: Insufficient permissions to create claim');
    }

    // 2. Idempotency Key check
    if (idempotencyKey) {
      const cached = CreateClaimUseCase.idempotencyStore.get(`${principal.tenantId}:${idempotencyKey}`);
      if (cached) {
        return cached;
      }
    }

    // 3. Uniqueness Check: Check claimCode per tenant
    const existing = await this.claimRepo.findByCode(principal.tenantId, dto.claimCode);
    if (existing) {
      throw new Error(`409 Conflict: Claim with code ${dto.claimCode} already exists`);
    }

    // 4. Construct aggregate
    const claimId = randomUUID();
    const claim = Claim.create({
      id: claimId,
      tenantId: principal.tenantId,
      distributorId: dto.distributorId,
      schemeId: dto.schemeId,
      name: dto.name,
      claimCode: dto.claimCode,
      claimAmountCents: dto.claimAmountCents,
      approvedAmountCents: dto.approvedAmountCents,
    });

    // 5. Persist to repository
    await this.claimRepo.save(claim);

    // 6. Outbox event publication
    const eventEnvelope = makeEnvelope(
      'claims.claim.created',
      'v1',
      {
        claimId: claim.id,
        distributorId: claim.distributorId,
        schemeId: claim.schemeId,
        name: claim.name,
        claimCode: claim.claimCode,
        claimAmountCents: claim.claimAmountCents,
        status: claim.status,
      },
      {
        tenantId: principal.tenantId,
        correlationId: principal.id,
        producer: 'claims-service',
        partitionKey: claim.id,
      }
    );

    try {
      await this.outboxRepo.save(
        null as any,
        {
          eventId: eventEnvelope.eventId,
          tenantId: claim.tenantId,
          type: eventEnvelope.type,
          version: 'v1',
          payload: eventEnvelope.payload,
        },
        'Claim',
        claim.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    if (idempotencyKey) {
      CreateClaimUseCase.idempotencyStore.set(`${principal.tenantId}:${idempotencyKey}`, claim);
    }

    return claim;
  }
}
