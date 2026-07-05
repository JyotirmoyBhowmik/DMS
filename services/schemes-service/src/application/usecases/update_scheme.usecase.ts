import { StructuredLogger, getCorrelation } from '@dms/pkg-logger';
import { SchemeEntity, SchemeStatus } from '../../domain/entities/scheme.entity.js';
import { SchemeAggregate } from '../../domain/aggregates/scheme.aggregate.js';
import { ISchemeRepository } from '../../domain/repositories/scheme.repository.js';
import { SchemePgRepository } from '../../infrastructure/database/repositories/scheme.pg-repository.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { TransactionalDbClient } from '../../infrastructure/database/transactional-client.js';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { z } from 'zod';

const SchemeSlabSchema = z.object({
  minQuantity: z.number().int().nonnegative().optional(),
  minAmount: z.number().int().nonnegative().optional(),
  discountPercentage: z.number().min(0).max(100).optional(),
  flatDiscountAmount: z.number().int().nonnegative().optional(),
  freeGoods: z.array(z.object({
    skuId: z.string().uuid(),
    quantity: z.number().int().positive(),
  })).optional(),
});

const ComboItemSchema = z.object({
  skuId: z.string().uuid(),
  minQty: z.number().int().positive(),
});

export const UpdateSchemeInputSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  status: z.enum(['draft', 'active', 'suspended', 'expired']).optional(),
  rules: z.object({
    minOrderAmount: z.number().int().nonnegative().optional(),
    applicableSkuIds: z.array(z.string().uuid()).optional(),
    slabs: z.array(SchemeSlabSchema).optional(),
    comboItems: z.array(ComboItemSchema).optional(),
    allowStacking: z.boolean().optional(),
    exclusionGroup: z.string().optional(),
  }).optional(),
  payouts: z.object({
    discountPercentage: z.number().min(0).max(100).optional(),
    flatDiscountAmount: z.number().int().nonnegative().optional(),
    freeGoods: z.array(z.object({
      skuId: z.string().uuid(),
      quantity: z.number().int().positive(),
    })).optional(),
  }).optional(),
  version: z.number(), // required for optimistic locking
});

export type UpdateSchemeInput = z.infer<typeof UpdateSchemeInputSchema>;

export class UpdateSchemeUseCase {
  private logger = new StructuredLogger('UpdateSchemeUseCase');
  private outboxRepo = new OutboxRepository({ tableName: 'schemes_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly schemeRepo?: ISchemeRepository
  ) {}

  async execute(tenantId: string, schemeId: string, input: UpdateSchemeInput): Promise<SchemeEntity> {
    this.logger.info('Updating scheme', { schemeId });

    const parsed = UpdateSchemeInputSchema.parse(input);

    if (!this.db) {
      throw new Error('Database client not configured');
    }

    let updatedEntity: SchemeEntity;

    await this.db.transaction(async (conn) => {
      const txDb = new TransactionalDbClient(conn);
      const repo = this.schemeRepo || new SchemePgRepository(txDb);

      const existing = await repo.findById(schemeId, tenantId);

      // Enforce optimistic locking check (version check)
      if (existing.version !== parsed.version) {
        throw new Error(`Concurrency check failed: version mismatch (expected ${existing.version}, got ${parsed.version})`);
      }

      // Update fields
      if (parsed.name !== undefined) existing.name = parsed.name;
      if (parsed.description !== undefined) existing.description = parsed.description;
      if (parsed.startDate !== undefined) existing.startDate = parsed.startDate;
      if (parsed.endDate !== undefined) existing.endDate = parsed.endDate;
      if (parsed.rules !== undefined) existing.rules = { ...existing.rules, ...parsed.rules };
      if (parsed.payouts !== undefined) existing.payouts = { ...existing.payouts, ...parsed.payouts };

      const aggregate = new SchemeAggregate(existing);

      // Handle status change transitions
      if (parsed.status !== undefined && parsed.status !== existing.status) {
        if (parsed.status === 'active') {
          aggregate.activate();
        } else if (parsed.status === 'suspended') {
          aggregate.suspend();
        } else if (parsed.status === 'expired') {
          aggregate.expire();
        } else if (parsed.status === 'draft') {
          throw new Error('Cannot revert active/suspended scheme to draft status');
        }
      }

      aggregate.validateInvariants();

      // Save update
      updatedEntity = await repo.update(existing, tenantId);

      // Create outbox event if status changed to active
      if (parsed.status === 'active' && parsed.status !== existing.status) {
        const activeCtx = getCorrelation();
        const event = makeEnvelope(
          'scheme.activated',
          'v1',
          {
            schemeId,
            name: updatedEntity.name,
            startDate: updatedEntity.startDate.toISOString(),
            endDate: updatedEntity.endDate?.toISOString(),
          },
          {
            tenantId,
            correlationId: activeCtx?.correlationId ?? 'correlation-uuid-mock',
            producer: 'schemes-service',
            partitionKey: schemeId,
            causationId: activeCtx?.causationId,
          }
        );

        await this.outboxRepo.save(conn, {
          eventId: event.eventId,
          tenantId,
          type: event.type,
          version: 'v1',
          payload: event.payload,
        }, 'Scheme', schemeId);
      }
    }, tenantId);

    return updatedEntity!;
  }
}
