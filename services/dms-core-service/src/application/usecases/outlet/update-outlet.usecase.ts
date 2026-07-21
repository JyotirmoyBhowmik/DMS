import { Outlet } from '../../../domain/entities/outlet.js';
import { OutletPgRepository } from '../../../infrastructure/database/repositories/outlet.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { UpdateOutletDTO } from '@dms/pkg-validation';

export class UpdateOutletUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });

  constructor(private outletRepo: OutletPgRepository) {}

  async execute(
    principal: Principal,
    id: string,
    dto: UpdateOutletDTO
  ): Promise<Outlet> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'outlet:update')) {
      throw new Error('Forbidden: Insufficient permissions to update outlet');
    }

    // 2. Fetch existing entity
    const existing = await this.outletRepo.findById(principal.tenantId, id);
    if (!existing || existing.tenantId !== principal.tenantId) {
      throw new Error(`Outlet with ID ${id} not found`);
    }

    // 3. Optimistic locking check
    if (dto.version !== undefined && existing.version !== dto.version) {
      throw new Error('409 Conflict: Optimistic locking failure, version mismatch');
    }

    // 4. Apply domain updates
    existing.updateDetails({
      name: dto.name,
      latitude: dto.latitude,
      longitude: dto.longitude,
      radiusMeters: dto.radiusMeters,
      channelType: dto.channelType as any,
      status: dto.status as any,
      address: dto.address,
      ownerName: dto.ownerName,
      ownerPhone: dto.ownerPhone,
    });


    // 5. Persist updated aggregate
    await this.outletRepo.save(existing);

    // 6. Record outbox event
    const eventEnvelope = makeEnvelope(
      'distributor.outlet.updated',
      'v1',
      {
        outletId: existing.id,
        name: existing.name,
        status: existing.status,
        channelType: existing.channelType,
        version: existing.version,
      },
      {
        tenantId: principal.tenantId,
        correlationId: principal.id,
        producer: 'dms-core-service',
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
        'Outlet',
        existing.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    return existing;
  }
}
