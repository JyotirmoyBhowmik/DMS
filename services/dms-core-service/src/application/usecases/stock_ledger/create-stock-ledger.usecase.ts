import { StockLedgerEntry } from '../../../domain/entities/stock_ledger_entry.js';
import { StockLedgerPgRepository } from '../../../infrastructure/database/repositories/stock_ledger.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { CreateStockLedgerDTO } from '@dms/pkg-validation';
import { randomUUID } from 'node:crypto';

export class CreateStockLedgerUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });
  private static idempotencyStore = new Map<string, StockLedgerEntry>();

  constructor(private stockLedgerRepo: StockLedgerPgRepository) {}

  async execute(
    principal: Principal,
    dto: CreateStockLedgerDTO,
    idempotencyKey?: string
  ): Promise<StockLedgerEntry> {
    // 1. Authorize inside use case
    if (!RbacGuard.can(principal, 'stock_ledger:create')) {
      throw new Error('Forbidden: Insufficient permissions to create stock ledger entry');
    }

    // 2. Idempotency Key check
    if (idempotencyKey) {
      const cached = CreateStockLedgerUseCase.idempotencyStore.get(`${principal.tenantId}:${idempotencyKey}`);
      if (cached) {
        return cached;
      }
    }

    // 3. Compute running balance
    const previousBalance = await this.stockLedgerRepo.getLatestBalance(
      principal.tenantId,
      dto.skuId,
      dto.warehouseId,
      dto.batchNumber
    );
    const runningBalance = StockLedgerEntry.computeRunningBalance(previousBalance, dto.transactionType, dto.quantity);

    // 4. Construct aggregate
    const entryId = randomUUID();
    const entry = StockLedgerEntry.create({
      id: entryId,
      tenantId: principal.tenantId,
      warehouseId: dto.warehouseId,
      skuId: dto.skuId,
      batchNumber: dto.batchNumber,
      transactionType: dto.transactionType,
      quantity: dto.quantity,
      runningBalance,
      referenceId: dto.referenceId,
    });

    // 5. Persist to repository
    await this.stockLedgerRepo.save(entry);

    // 6. Outbox event publication
    const eventEnvelope = makeEnvelope(
      'distributor.stock_ledger.recorded',
      'v1',
      {
        entryId: entry.id,
        warehouseId: entry.warehouseId,
        skuId: entry.skuId,
        transactionType: entry.transactionType,
        quantity: entry.quantity,
        runningBalance: entry.runningBalance,
      },
      {
        tenantId: principal.tenantId,
        correlationId: principal.id,
        producer: 'dms-core-service',
        partitionKey: entry.id,
      }
    );

    try {
      await this.outboxRepo.save(
        null as any,
        {
          eventId: eventEnvelope.eventId,
          tenantId: entry.tenantId,
          type: eventEnvelope.type,
          version: 'v1',
          payload: eventEnvelope.payload,
        },
        'StockLedgerEntry',
        entry.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    if (idempotencyKey) {
      CreateStockLedgerUseCase.idempotencyStore.set(`${principal.tenantId}:${idempotencyKey}`, entry);
    }

    return entry;
  }
}
