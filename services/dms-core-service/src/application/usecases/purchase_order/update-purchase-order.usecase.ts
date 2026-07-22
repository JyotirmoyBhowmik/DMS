import { PurchaseOrder } from '../../../domain/entities/purchase_order.js';
import { PurchaseOrderPgRepository } from '../../../infrastructure/database/repositories/purchase_order.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { UpdatePurchaseOrderDTO } from '@dms/pkg-validation';

export class UpdatePurchaseOrderUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });

  constructor(private poRepo: PurchaseOrderPgRepository) {}

  async execute(
    principal: Principal,
    id: string,
    dto: UpdatePurchaseOrderDTO
  ): Promise<PurchaseOrder> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'purchase_order:update')) {
      throw new Error('Forbidden: Insufficient permissions to update purchase order');
    }

    // 2. Fetch existing entity
    const existing = await this.poRepo.findById(principal.tenantId, id);
    if (!existing || existing.tenantId !== principal.tenantId) {
      throw new Error(`PurchaseOrder with ID ${id} not found`);
    }

    // 3. Optimistic locking check
    if (dto.version !== undefined && existing.version !== dto.version) {
      throw new Error('409 Conflict: Optimistic locking failure, version mismatch');
    }

    // 4. Apply state transitions or amount updates
    if (dto.totalAmountCents !== undefined) {
      existing.updateAmount(dto.totalAmountCents);
    }
    if (dto.status !== undefined) {
      existing.updateStatus(dto.status);
    }

    // 5. Persist updated aggregate
    await this.poRepo.save(existing);

    // 6. Record outbox event
    const eventEnvelope = makeEnvelope(
      'distributor.purchase_order.status_updated',
      'v1',
      {
        poId: existing.id,
        poNumber: existing.poNumber,
        totalAmountCents: existing.totalAmountCents,
        status: existing.status,
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
        'PurchaseOrder',
        existing.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    return existing;
  }
}
