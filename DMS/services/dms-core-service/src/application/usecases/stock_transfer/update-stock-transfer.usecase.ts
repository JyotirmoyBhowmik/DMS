import { StockTransfer } from '../../../domain/entities/stock_transfer.js';
import { StockTransferPgRepository } from '../../../infrastructure/database/repositories/stock_transfer.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { UpdateStockTransferDTO } from '@dms/pkg-validation';

export class UpdateStockTransferUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });

  constructor(private stockTransferRepo: StockTransferPgRepository) {}

  async execute(
    principal: Principal,
    id: string,
    dto: UpdateStockTransferDTO
  ): Promise<StockTransfer> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'stock_transfer:update')) {
      throw new Error('Forbidden: Insufficient permissions to update stock transfer');
    }

    // 2. Fetch existing entity
    const existing = await this.stockTransferRepo.findById(principal.tenantId, id);
    if (!existing || existing.tenantId !== principal.tenantId) {
      throw new Error(`StockTransfer with ID ${id} not found`);
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
    await this.stockTransferRepo.save(existing);

    // 6. Record outbox event
    const eventEnvelope = makeEnvelope(
      'distributor.stock_transfer.status_updated',
      'v1',
      {
        transferId: existing.id,
        transferNumber: existing.transferNumber,
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
        'StockTransfer',
        existing.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    return existing;
  }
}
