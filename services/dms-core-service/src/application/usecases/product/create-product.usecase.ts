import { Product } from '../../../domain/entities/product.js';
import { ProductPgRepository } from '../../../infrastructure/database/repositories/product.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { CreateProductDTO } from '@dms/pkg-validation';
import { randomUUID } from 'node:crypto';

export class CreateProductUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });
  private static idempotencyStore = new Map<string, Product>();

  constructor(private productRepo: ProductPgRepository) {}

  async execute(
    principal: Principal,
    dto: CreateProductDTO,
    idempotencyKey?: string
  ): Promise<Product> {
    // 1. Authorize inside use case
    if (!RbacGuard.can(principal, 'product:create')) {
      throw new Error('Forbidden: Insufficient permissions to create product');
    }

    // 2. Idempotency Key check
    if (idempotencyKey) {
      const cached = CreateProductUseCase.idempotencyStore.get(`${principal.tenantId}:${idempotencyKey}`);
      if (cached) {
        return cached;
      }
    }

    // 3. Uniqueness Check: Check SKU per tenant
    const existing = await this.productRepo.findBySku(principal.tenantId, dto.sku);
    if (existing) {
      throw new Error(`409 Conflict: Product SKU ${dto.sku} already exists`);
    }

    // 4. Construct aggregate
    const productId = randomUUID();
    const product = Product.create({
      id: productId,
      tenantId: principal.tenantId,
      sku: dto.sku,
      name: dto.name,
      category: dto.category,
      price: dto.price,
      minThreshold: dto.minThreshold ?? 10,
      uom: dto.uom ?? 'UNIT',
    });


    // 5. Persist to repository
    await this.productRepo.save(product);

    // 6. Outbox event publication
    const eventEnvelope = makeEnvelope(
      'distributor.product.created',
      'v1',
      {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        category: product.category,
        price: product.price,
      },
      {
        tenantId: principal.tenantId,
        correlationId: principal.id,
        producer: 'dms-core-service',
        partitionKey: product.id,
      }
    );

    try {
      await this.outboxRepo.save(
        null as any,
        {
          eventId: eventEnvelope.eventId,
          tenantId: product.tenantId,
          type: eventEnvelope.type,
          version: 'v1',
          payload: eventEnvelope.payload,
        },
        'Product',
        product.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    if (idempotencyKey) {
      CreateProductUseCase.idempotencyStore.set(`${principal.tenantId}:${idempotencyKey}`, product);
    }

    return product;
  }
}
