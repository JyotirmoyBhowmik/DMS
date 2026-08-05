import { PriceList } from '../../domain/entities/price_list.js';
import { PriceListPgRepository } from '../../infrastructure/database/repositories/price_list.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { CreatePriceListDTO } from '@dms/pkg-validation';
import { randomUUID } from 'node:crypto';

export class CreatePriceListUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });
  private static idempotencyStore = new Map<string, PriceList>();

  constructor(private listRepo: PriceListPgRepository) {}

  async execute(
    principal: Principal,
    dto: CreatePriceListDTO,
    idempotencyKey?: string
  ): Promise<PriceList> {
    // 1. Authorize inside use case
    if (!RbacGuard.can(principal, 'price_list:create')) {
      throw new Error('Forbidden: Insufficient permissions to create price list');
    }

    // 2. Idempotency Key check
    if (idempotencyKey) {
      const cached = CreatePriceListUseCase.idempotencyStore.get(`${principal.tenantId}:${idempotencyKey}`);
      if (cached) {
        return cached;
      }
    }

    // 3. Uniqueness Check: Check code per tenant
    const existing = await this.listRepo.findByCode(principal.tenantId, dto.code);
    if (existing) {
      throw new Error(`409 Conflict: Price list with code ${dto.code} already exists`);
    }

    // 4. Construct aggregate
    const listId = randomUUID();
    const list = PriceList.create({
      id: listId,
      tenantId: principal.tenantId,
      name: dto.name,
      code: dto.code,
      currency: dto.currency ?? 'INR',
      validFrom: dto.validFrom,
      validTo: dto.validTo,
    });

    // 5. Persist to repository
    await this.listRepo.save(list);

    // 6. Outbox event publication
    const eventEnvelope = makeEnvelope(
      'pricing.price_list.created',
      'v1',
      {
        listId: list.id,
        name: list.name,
        code: list.code,
        currency: list.currency,
        status: list.status,
      },
      {
        tenantId: principal.tenantId,
        correlationId: principal.id,
        producer: 'pricing-service',
        partitionKey: list.id,
      }
    );

    try {
      await this.outboxRepo.save(
        null as any,
        {
          eventId: eventEnvelope.eventId,
          tenantId: list.tenantId,
          type: eventEnvelope.type,
          version: 'v1',
          payload: eventEnvelope.payload,
        },
        'PriceList',
        list.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    if (idempotencyKey) {
      CreatePriceListUseCase.idempotencyStore.set(`${principal.tenantId}:${idempotencyKey}`, list);
    }

    return list;
  }
}
