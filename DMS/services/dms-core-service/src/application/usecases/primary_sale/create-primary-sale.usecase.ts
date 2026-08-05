import { PrimarySale } from '../../../domain/entities/primary_sale.js';
import { PrimarySalePgRepository } from '../../../infrastructure/database/repositories/primary_sale.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { CreatePrimarySaleDTO } from '@dms/pkg-validation';
import { randomUUID } from 'node:crypto';

export class CreatePrimarySaleUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });
  private static idempotencyStore = new Map<string, PrimarySale>();

  constructor(private saleRepo: PrimarySalePgRepository) {}

  async execute(
    principal: Principal,
    dto: CreatePrimarySaleDTO,
    idempotencyKey?: string
  ): Promise<PrimarySale> {
    // 1. Authorize inside use case
    if (!RbacGuard.can(principal, 'primary_sale:create')) {
      throw new Error('Forbidden: Insufficient permissions to create primary sale');
    }

    // 2. Idempotency Key check
    if (idempotencyKey) {
      const cached = CreatePrimarySaleUseCase.idempotencyStore.get(`${principal.tenantId}:${idempotencyKey}`);
      if (cached) {
        return cached;
      }
    }

    // 3. Uniqueness Check: Check invoiceNumber per tenant
    const existing = await this.saleRepo.findByInvoiceNumber(principal.tenantId, dto.invoiceNumber);
    if (existing) {
      throw new Error(`409 Conflict: Primary sale with invoice number ${dto.invoiceNumber} already exists`);
    }

    // 4. Construct aggregate
    const saleId = randomUUID();
    const sale = PrimarySale.create({
      id: saleId,
      tenantId: principal.tenantId,
      invoiceNumber: dto.invoiceNumber,
      distributorId: dto.distributorId,
      warehouseId: dto.warehouseId,
      skuId: dto.skuId,
      quantity: dto.quantity,
      unitPriceCents: dto.unitPriceCents,
      totalAmountCents: dto.totalAmountCents,
    });

    // 5. Persist to repository
    await this.saleRepo.save(sale);

    // 6. Outbox event publication
    const eventEnvelope = makeEnvelope(
      'distributor.primary_sale.created',
      'v1',
      {
        saleId: sale.id,
        invoiceNumber: sale.invoiceNumber,
        distributorId: sale.distributorId,
        warehouseId: sale.warehouseId,
        skuId: sale.skuId,
        quantity: sale.quantity,
        unitPriceCents: sale.unitPriceCents,
        totalAmountCents: sale.totalAmountCents,
        status: sale.status,
      },
      {
        tenantId: principal.tenantId,
        correlationId: principal.id,
        producer: 'dms-core-service',
        partitionKey: sale.id,
      }
    );

    try {
      await this.outboxRepo.save(
        null as any,
        {
          eventId: eventEnvelope.eventId,
          tenantId: sale.tenantId,
          type: eventEnvelope.type,
          version: 'v1',
          payload: eventEnvelope.payload,
        },
        'PrimarySale',
        sale.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    if (idempotencyKey) {
      CreatePrimarySaleUseCase.idempotencyStore.set(`${principal.tenantId}:${idempotencyKey}`, sale);
    }

    return sale;
  }
}
