import { ProductCategory } from '../../../domain/entities/product_category.js';
import { ProductCategoryPgRepository } from '../../../infrastructure/database/repositories/product_category.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { CreateProductCategoryDTO } from '@dms/pkg-validation';
import { randomUUID } from 'node:crypto';

export class CreateProductCategoryUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });
  private static idempotencyStore = new Map<string, ProductCategory>();

  constructor(private categoryRepo: ProductCategoryPgRepository) {}

  async execute(
    principal: Principal,
    dto: CreateProductCategoryDTO,
    idempotencyKey?: string
  ): Promise<ProductCategory> {
    // 1. Authorize inside use case
    if (!RbacGuard.can(principal, 'product_category:create')) {
      throw new Error('Forbidden: Insufficient permissions to create product category');
    }

    // 2. Idempotency Key check
    if (idempotencyKey) {
      const cached = CreateProductCategoryUseCase.idempotencyStore.get(`${principal.tenantId}:${idempotencyKey}`);
      if (cached) {
        return cached;
      }
    }

    // 3. Uniqueness Check: Check Category Code per tenant
    const existing = await this.categoryRepo.findByCode(principal.tenantId, dto.code);
    if (existing) {
      throw new Error(`409 Conflict: Category Code ${dto.code} already exists`);
    }

    // 4. Construct aggregate
    const categoryId = randomUUID();
    const category = ProductCategory.create({
      id: categoryId,
      tenantId: principal.tenantId,
      code: dto.code,
      name: dto.name,
      parentCategoryId: dto.parentCategoryId,
      description: dto.description,
    });

    // 5. Persist to repository
    await this.categoryRepo.save(category);

    // 6. Outbox event publication
    const eventEnvelope = makeEnvelope(
      'distributor.product_category.created',
      'v1',
      {
        categoryId: category.id,
        code: category.code,
        name: category.name,
      },
      {
        tenantId: principal.tenantId,
        correlationId: principal.id,
        producer: 'dms-core-service',
        partitionKey: category.id,
      }
    );

    try {
      await this.outboxRepo.save(
        null as any,
        {
          eventId: eventEnvelope.eventId,
          tenantId: category.tenantId,
          type: eventEnvelope.type,
          version: 'v1',
          payload: eventEnvelope.payload,
        },
        'ProductCategory',
        category.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    if (idempotencyKey) {
      CreateProductCategoryUseCase.idempotencyStore.set(`${principal.tenantId}:${idempotencyKey}`, category);
    }

    return category;
  }
}
