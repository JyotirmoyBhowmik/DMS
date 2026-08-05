import { Outlet } from '../../../domain/entities/outlet.js';
import { OutletPgRepository } from '../../../infrastructure/database/repositories/outlet.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { CreateOutletDTO } from '@dms/pkg-validation';
import { randomUUID } from 'node:crypto';

export class CreateOutletUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });
  private static idempotencyStore = new Map<string, Outlet>();

  constructor(private outletRepo: OutletPgRepository) {}

  async execute(
    principal: Principal,
    dto: CreateOutletDTO,
    idempotencyKey?: string
  ): Promise<Outlet> {
    // 1. Authorize inside use case
    if (!RbacGuard.can(principal, 'outlet:create')) {
      throw new Error('Forbidden: Insufficient permissions to create outlet');
    }

    // 2. Idempotency Key check
    if (idempotencyKey) {
      const cached = CreateOutletUseCase.idempotencyStore.get(`${principal.tenantId}:${idempotencyKey}`);
      if (cached) {
        return cached;
      }
    }

    // 3. Construct aggregate
    const outletId = randomUUID();
    const outlet = Outlet.create({
      id: outletId,
      tenantId: principal.tenantId,
      name: dto.name,
      latitude: dto.latitude,
      longitude: dto.longitude,
      radiusMeters: dto.radiusMeters,
      channelType: dto.channelType as any,
      address: dto.address,
      ownerName: dto.ownerName,
      ownerPhone: dto.ownerPhone,
      distributorId: dto.distributorId,
    });

    // 4. Persist to repository
    await this.outletRepo.save(outlet);

    // 5. Outbox event publication
    const eventEnvelope = makeEnvelope(
      'distributor.outlet.created',
      'v1',
      {
        outletId: outlet.id,
        name: outlet.name,
        channelType: outlet.channelType,
        status: outlet.status,
      },
      {
        tenantId: principal.tenantId,
        correlationId: principal.id,
        producer: 'dms-core-service',
        partitionKey: outlet.id,
      }
    );

    try {
      await this.outboxRepo.save(
        null as any,
        {
          eventId: eventEnvelope.eventId,
          tenantId: outlet.tenantId,
          type: eventEnvelope.type,
          version: 'v1',
          payload: eventEnvelope.payload,
        },
        'Outlet',
        outlet.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    if (idempotencyKey) {
      CreateOutletUseCase.idempotencyStore.set(`${principal.tenantId}:${idempotencyKey}`, outlet);
    }

    return outlet;
  }
}
