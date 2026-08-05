import { GoodsReceipt } from '../../../domain/entities/goods_receipt.js';
import { GoodsReceiptPgRepository } from '../../../infrastructure/database/repositories/goods_receipt.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { UpdateGoodsReceiptDTO } from '@dms/pkg-validation';

export class UpdateGoodsReceiptUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });

  constructor(private grRepo: GoodsReceiptPgRepository) {}

  async execute(
    principal: Principal,
    id: string,
    dto: UpdateGoodsReceiptDTO
  ): Promise<GoodsReceipt> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'goods_receipt:update')) {
      throw new Error('Forbidden: Insufficient permissions to update goods receipt');
    }

    // 2. Fetch existing entity
    const existing = await this.grRepo.findById(principal.tenantId, id);
    if (!existing || existing.tenantId !== principal.tenantId) {
      throw new Error(`GoodsReceipt with ID ${id} not found`);
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
    await this.grRepo.save(existing);

    // 6. Record outbox event
    const eventEnvelope = makeEnvelope(
      'distributor.goods_receipt.status_updated',
      'v1',
      {
        grId: existing.id,
        receiptNumber: existing.receiptNumber,
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
        'GoodsReceipt',
        existing.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    return existing;
  }
}
