import { SecondarySale } from '../../../domain/entities/secondary_sale.js';
import { SecondarySalePgRepository } from '../../../infrastructure/database/repositories/secondary_sale.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { CreateSecondarySaleDTO } from '@dms/pkg-validation';
import { randomUUID } from 'node:crypto';

export class CreateSecondarySaleUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });
  private static idempotencyStore = new Map<string, SecondarySale>();

  constructor(private saleRepo: SecondarySalePgRepository) {}

  async execute(
    principal: Principal,
    dto: CreateSecondarySaleDTO,
    idempotencyKey?: string
  ): Promise<SecondarySale> {
    // 1. Authorize inside use case
    if (!RbacGuard.can(principal, 'secondary_sale:create')) {
      throw new Error('Forbidden: Insufficient permissions to create secondary sale');
    }

    // 2. Idempotency Key check
    if (idempotencyKey) {
      const cached = CreateSecondarySaleUseCase.idempotencyStore.get(`${principal.tenantId}:${idempotencyKey}`);
      if (cached) {
        return cached;
      }
    }

    // 3. Uniqueness Check: Check invoiceNumber per tenant
    const existing = await this.saleRepo.findByInvoiceNumber(principal.tenantId, dto.invoiceNumber);
    if (existing) {
      throw new Error(`409 Conflict: Secondary sale with invoice number ${dto.invoiceNumber} already exists`);
    }

    // 4. Construct aggregate
    const saleId = randomUUID();
    const sale = SecondarySale.create({
      id: saleId,
      tenantId: principal.tenantId,
      invoiceNumber: dto.invoiceNumber,
      outletId: dto.outletId,
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
      'distributor.secondary_sale.created',
      'v1',
      {
        saleId: sale.id,
        invoiceNumber: sale.invoiceNumber,
        outletId: sale.outletId,
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
        'SecondarySale',
        sale.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    if (idempotencyKey) {
      CreateSecondarySaleUseCase.idempotencyStore.set(`${principal.tenantId}:${idempotencyKey}`, sale);
    }

    return sale;
  }
}
