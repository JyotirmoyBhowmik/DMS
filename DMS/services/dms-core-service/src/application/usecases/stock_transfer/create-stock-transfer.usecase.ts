import { StockTransfer } from '../../../domain/entities/stock_transfer.js';
import { StockTransferPgRepository } from '../../../infrastructure/database/repositories/stock_transfer.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { CreateStockTransferDTO } from '@dms/pkg-validation';
import { randomUUID } from 'node:crypto';

export class CreateStockTransferUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });
  private static idempotencyStore = new Map<string, StockTransfer>();

  constructor(private stockTransferRepo: StockTransferPgRepository) {}

  async execute(
    principal: Principal,
    dto: CreateStockTransferDTO,
    idempotencyKey?: string
  ): Promise<StockTransfer> {
    // 1. Authorize inside use case
    if (!RbacGuard.can(principal, 'stock_transfer:create')) {
      throw new Error('Forbidden: Insufficient permissions to create stock transfer');
    }

    // 2. Idempotency Key check
    if (idempotencyKey) {
      const cached = CreateStockTransferUseCase.idempotencyStore.get(`${principal.tenantId}:${idempotencyKey}`);
      if (cached) {
        return cached;
      }
    }

    // 3. Uniqueness Check: Check transferNumber per tenant
    const existing = await this.stockTransferRepo.findByTransferNumber(principal.tenantId, dto.transferNumber);
    if (existing) {
      throw new Error(`409 Conflict: Stock transfer with number ${dto.transferNumber} already exists`);
    }

    // 4. Construct aggregate
    const transferId = randomUUID();
    const transfer = StockTransfer.create({
      id: transferId,
      tenantId: principal.tenantId,
      transferNumber: dto.transferNumber,
      sourceWarehouseId: dto.sourceWarehouseId,
      targetWarehouseId: dto.targetWarehouseId,
      skuId: dto.skuId,
      quantity: dto.quantity,
    });

    // 5. Persist to repository
    await this.stockTransferRepo.save(transfer);

    // 6. Outbox event publication
    const eventEnvelope = makeEnvelope(
      'distributor.stock_transfer.created',
      'v1',
      {
        transferId: transfer.id,
        transferNumber: transfer.transferNumber,
        sourceWarehouseId: transfer.sourceWarehouseId,
        targetWarehouseId: transfer.targetWarehouseId,
        skuId: transfer.skuId,
        quantity: transfer.quantity,
        status: transfer.status,
      },
      {
        tenantId: principal.tenantId,
        correlationId: principal.id,
        producer: 'dms-core-service',
        partitionKey: transfer.id,
      }
    );

    try {
      await this.outboxRepo.save(
        null as any,
        {
          eventId: eventEnvelope.eventId,
          tenantId: transfer.tenantId,
          type: eventEnvelope.type,
          version: 'v1',
          payload: eventEnvelope.payload,
        },
        'StockTransfer',
        transfer.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    if (idempotencyKey) {
      CreateStockTransferUseCase.idempotencyStore.set(`${principal.tenantId}:${idempotencyKey}`, transfer);
    }

    return transfer;
  }
}
