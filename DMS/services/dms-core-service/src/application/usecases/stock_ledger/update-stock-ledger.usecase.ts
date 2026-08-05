import { StockLedgerEntry } from '../../../domain/entities/stock_ledger_entry.js';
import { StockLedgerPgRepository } from '../../../infrastructure/database/repositories/stock_ledger.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { UpdateStockLedgerDTO } from '@dms/pkg-validation';

export class UpdateStockLedgerUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });

  constructor(private stockLedgerRepo: StockLedgerPgRepository) {}

  async execute(
    principal: Principal,
    id: string,
    dto: UpdateStockLedgerDTO
  ): Promise<StockLedgerEntry> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'stock_ledger:update')) {
      throw new Error('Forbidden: Insufficient permissions to update stock ledger entry');
    }

    // 2. Fetch existing entity
    const existing = await this.stockLedgerRepo.findById(principal.tenantId, id);
    if (!existing || existing.tenantId !== principal.tenantId) {
      throw new Error(`StockLedgerEntry with ID ${id} not found`);
    }

    // 3. Optimistic locking check
    if (dto.version !== undefined && existing.version !== dto.version) {
      throw new Error('409 Conflict: Optimistic locking failure, version mismatch');
    }

    // 4. Apply updates
    existing.updateDetails(dto.quantity, dto.referenceId);

    // 5. Persist updated aggregate
    await this.stockLedgerRepo.save(existing);

    // 6. Record outbox event
    const eventEnvelope = makeEnvelope(
      'distributor.stock_ledger.updated',
      'v1',
      {
        entryId: existing.id,
        quantity: existing.quantity,
        referenceId: existing.referenceId,
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
        'StockLedgerEntry',
        existing.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    return existing;
  }
}
