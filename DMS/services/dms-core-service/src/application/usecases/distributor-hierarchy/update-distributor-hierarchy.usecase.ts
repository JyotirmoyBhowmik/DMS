import { DistributorHierarchy } from '../../../domain/entities/distributor-hierarchy.js';
import { DistributorHierarchyPgRepository } from '../../../infrastructure/database/repositories/distributor-hierarchy.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { UpdateDistributorHierarchyDTO } from '@dms/pkg-validation';

export class UpdateDistributorHierarchyUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });

  constructor(private hierarchyRepo: DistributorHierarchyPgRepository) {}

  async execute(principal: Principal, id: string, dto: UpdateDistributorHierarchyDTO): Promise<DistributorHierarchy> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'distributor_hierarchy:update')) {
      throw new Error('Forbidden: Insufficient permissions to update distributor hierarchy');
    }

    // 2. Fetch existing hierarchy record
    const existing = await this.hierarchyRepo.findById(principal.tenantId, id);
    if (!existing || existing.tenantId !== principal.tenantId) {
      throw new Error(`DistributorHierarchy with ID ${id} not found`);
    }

    // 3. Optimistic locking check
    if (dto.version !== undefined && existing.version !== dto.version) {
      throw new Error('409 Conflict: Optimistic locking failure, version mismatch');
    }

    // 4. Apply state changes
    if (dto.isActive === false && existing.isActive) {
      existing.deactivate();
    } else if (dto.isActive === true && !existing.isActive) {
      existing.activate();
    }

    // 5. Save updated entity to repository
    await this.hierarchyRepo.save(existing);

    // 6. Emit outbox event transactionally
    const eventEnvelope = makeEnvelope(
      'distributor.hierarchy.updated',
      'v1',
      {
        hierarchyId: existing.id,
        tenantId: existing.tenantId,
        parentDistributorId: existing.parentDistributorId,
        childDistributorId: existing.childDistributorId,
        hierarchyLevel: existing.hierarchyLevel,
        isActive: existing.isActive,
        version: existing.version,
      },
      {
        tenantId: principal.tenantId,
        correlationId: principal.id,
        producer: 'dms-core-service',
        partitionKey: existing.id,
      }
    );

    // Outbox save best effort fallback
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
        'DistributorHierarchy',
        existing.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    return existing;


  }
}
