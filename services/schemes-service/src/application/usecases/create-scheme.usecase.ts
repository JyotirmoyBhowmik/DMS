import { Scheme, SchemeType } from '../../domain/entities/scheme.js';
import { SchemePgRepository } from '../../infrastructure/database/repositories/scheme.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { CreateSchemeDTO } from '@dms/pkg-validation';
import { randomUUID } from 'node:crypto';

export class CreateSchemeUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });
  private static idempotencyStore = new Map<string, Scheme>();

  constructor(private schemeRepo: SchemePgRepository) {}

  async execute(
    principal: Principal,
    dto: CreateSchemeDTO,
    idempotencyKey?: string
  ): Promise<Scheme> {
    // 1. Authorize inside use case
    if (!RbacGuard.can(principal, 'scheme:create')) {
      throw new Error('Forbidden: Insufficient permissions to create scheme');
    }

    // 2. Idempotency Key check
    if (idempotencyKey) {
      const cached = CreateSchemeUseCase.idempotencyStore.get(`${principal.tenantId}:${idempotencyKey}`);
      if (cached) {
        return cached;
      }
    }

    // 3. Uniqueness Check: Check code per tenant
    const existing = await this.schemeRepo.findByCode(principal.tenantId, dto.code);
    if (existing) {
      throw new Error(`409 Conflict: Scheme with code ${dto.code} already exists`);
    }

    // 4. Construct aggregate
    const schemeId = randomUUID();
    const scheme = Scheme.create({
      id: schemeId,
      tenantId: principal.tenantId,
      name: dto.name,
      code: dto.code,
      schemeType: dto.schemeType as SchemeType,
      description: dto.description,
    });

    // 5. Persist to repository
    await this.schemeRepo.save(scheme);

    // 6. Outbox event publication
    const eventEnvelope = makeEnvelope(
      'schemes.scheme.created',
      'v1',
      {
        schemeId: scheme.id,
        name: scheme.name,
        code: scheme.code,
        schemeType: scheme.schemeType,
        status: scheme.status,
      },
      {
        tenantId: principal.tenantId,
        correlationId: principal.id,
        producer: 'schemes-service',
        partitionKey: scheme.id,
      }
    );

    try {
      await this.outboxRepo.save(
        null as any,
        {
          eventId: eventEnvelope.eventId,
          tenantId: scheme.tenantId,
          type: eventEnvelope.type,
          version: 'v1',
          payload: eventEnvelope.payload,
        },
        'Scheme',
        scheme.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    if (idempotencyKey) {
      CreateSchemeUseCase.idempotencyStore.set(`${principal.tenantId}:${idempotencyKey}`, scheme);
    }

    return scheme;
  }
}
