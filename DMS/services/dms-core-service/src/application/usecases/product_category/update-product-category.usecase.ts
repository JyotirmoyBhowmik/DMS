import { ProductCategory } from '../../../domain/entities/product_category.js';
import { ProductCategoryPgRepository } from '../../../infrastructure/database/repositories/product_category.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { UpdateProductCategoryDTO } from '@dms/pkg-validation';

export class UpdateProductCategoryUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });

  constructor(private categoryRepo: ProductCategoryPgRepository) {}

  async execute(
    principal: Principal,
    id: string,
    dto: UpdateProductCategoryDTO
  ): Promise<ProductCategory> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'product_category:update')) {
      throw new Error('Forbidden: Insufficient permissions to update product category');
    }

    // 2. Fetch existing entity
    const existing = await this.categoryRepo.findById(principal.tenantId, id);
    if (!existing || existing.tenantId !== principal.tenantId) {
      throw new Error(`ProductCategory with ID ${id} not found`);
    }

    // 3. Optimistic locking check
    if (dto.version !== undefined && existing.version !== dto.version) {
      throw new Error('409 Conflict: Optimistic locking failure, version mismatch');
    }

    // 4. Apply domain updates
    existing.updateDetails({
      name: dto.name,
      parentCategoryId: dto.parentCategoryId,
      description: dto.description,
      status: dto.status as any,
    });

    // 5. Persist updated aggregate
    await this.categoryRepo.save(existing);

    // 6. Record outbox event
    const eventEnvelope = makeEnvelope(
      'distributor.product_category.updated',
      'v1',
      {
        categoryId: existing.id,
        code: existing.code,
        name: existing.name,
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
        'ProductCategory',
        existing.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    return existing;
  }
}
