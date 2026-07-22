import { TertiarySale } from '../../../domain/entities/tertiary_sale.js';
import { TertiarySalePgRepository } from '../../../infrastructure/database/repositories/tertiary_sale.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { CreateTertiarySaleDTO } from '@dms/pkg-validation';
import { randomUUID } from 'node:crypto';

export class CreateTertiarySaleUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });
  private static idempotencyStore = new Map<string, TertiarySale>();

  constructor(private saleRepo: TertiarySalePgRepository) {}

  async execute(
    principal: Principal,
    dto: CreateTertiarySaleDTO,
    idempotencyKey?: string
  ): Promise<TertiarySale> {
    // 1. Authorize inside use case
    if (!RbacGuard.can(principal, 'tertiary_sale:create')) {
      throw new Error('Forbidden: Insufficient permissions to create tertiary sale');
    }

    // 2. Idempotency Key check
    if (idempotencyKey) {
      const cached = CreateTertiarySaleUseCase.idempotencyStore.get(`${principal.tenantId}:${idempotencyKey}`);
      if (cached) {
        return cached;
      }
    }

    // 3. Uniqueness Check: Check invoiceNumber per tenant
    const existing = await this.saleRepo.findByInvoiceNumber(principal.tenantId, dto.invoiceNumber);
    if (existing) {
      throw new Error(`409 Conflict: Tertiary sale with invoice number ${dto.invoiceNumber} already exists`);
    }

    // 4. Construct aggregate
    const saleId = randomUUID();
    const sale = TertiarySale.create({
      id: saleId,
      tenantId: principal.tenantId,
      invoiceNumber: dto.invoiceNumber,
      consumerId: dto.consumerId,
      outletId: dto.outletId,
      skuId: dto.skuId,
      quantity: dto.quantity,
      unitPriceCents: dto.unitPriceCents,
      totalAmountCents: dto.totalAmountCents,
    });

    // 5. Persist to repository
    await this.saleRepo.save(sale);

    // 6. Outbox event publication
    const eventEnvelope = makeEnvelope(
      'distributor.tertiary_sale.created',
      'v1',
      {
        saleId: sale.id,
        invoiceNumber: sale.invoiceNumber,
        consumerId: sale.consumerId,
        outletId: sale.outletId,
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
        'TertiarySale',
        sale.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    if (idempotencyKey) {
      CreateTertiarySaleUseCase.idempotencyStore.set(`${principal.tenantId}:${idempotencyKey}`, sale);
    }

    return sale;
  }
}
