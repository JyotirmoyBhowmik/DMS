import { randomUUID } from 'node:crypto';
import { StructuredLogger, getCorrelation } from '@dms/pkg-logger';
import { SchemeEntity } from '../../domain/entities/scheme.entity.js';
import { SchemeAggregate } from '../../domain/aggregates/scheme.aggregate.js';
import { makeEnvelope } from '@dms/pkg-events';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { ISchemeRepository } from '../../domain/repositories/scheme.repository.js';
import { SchemePgRepository } from '../../infrastructure/database/repositories/scheme.pg-repository.js';
import { TransactionalDbClient } from '../../infrastructure/database/transactional-client.js';
import { OutboxRepository } from '@dms/pkg-events';
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

export const CreateSchemeInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  rules: z.object({
    minOrderAmount: z.number().int().nonnegative().optional(),
    applicableSkuIds: z.array(z.string().uuid()).optional(),
    slabs: z.array(SchemeSlabSchema).optional(),
    comboItems: z.array(ComboItemSchema).optional(),
    allowStacking: z.boolean().optional(),
    exclusionGroup: z.string().optional(),
  }).default({}),
  payouts: z.object({
    discountPercentage: z.number().min(0).max(100).optional(),
    flatDiscountAmount: z.number().int().nonnegative().optional(),
    freeGoods: z.array(z.object({
      skuId: z.string().uuid(),
      quantity: z.number().int().positive(),
    })).optional(),
  }).default({}),
});

export type CreateSchemeInput = z.infer<typeof CreateSchemeInputSchema>;

export class CreateSchemeUseCase {
  private logger = new StructuredLogger('CreateSchemeUseCase');
  private outboxRepo = new OutboxRepository({ tableName: 'schemes_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly schemeRepo?: ISchemeRepository,
  ) {}

  async execute(tenantId: string, input: CreateSchemeInput): Promise<{ schemeId: string }> {
    this.logger.info('Creating a new scheme', { name: input.name });

    // Validate Input
    const parsedInput = CreateSchemeInputSchema.parse(input);

    const schemeId = parsedInput.id || randomUUID();
    const entity = new SchemeEntity({
      id: schemeId,
      tenantId,
      name: parsedInput.name,
      description: parsedInput.description,
      status: 'draft',
      startDate: parsedInput.startDate,
      endDate: parsedInput.endDate,
      rules: parsedInput.rules,
      payouts: parsedInput.payouts,
    });

    const aggregate = new SchemeAggregate(entity);
    aggregate.validateInvariants();

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'scheme.created',
      'v1',
      {
        schemeId,
        name: entity.name,
        startDate: entity.startDate.toISOString(),
        endDate: entity.endDate?.toISOString(),
        rules: entity.rules,
        payouts: entity.payouts,
      },
      {
        tenantId,
        correlationId: activeCtx?.correlationId ?? 'correlation-uuid-mock',
        producer: 'schemes-service',
        partitionKey: schemeId,
        causationId: activeCtx?.causationId,
      }
    );

    if (this.db) {
      await this.db.transaction(async (conn) => {
        const txDb = new TransactionalDbClient(conn);
        const txRepo = this.schemeRepo || new SchemePgRepository(txDb);

        // 1. Save scheme
        await txRepo.save(entity, tenantId);

        // 2. Save outbox event
        await this.outboxRepo.save(conn, {
          eventId: event.eventId,
          tenantId,
          type: event.type,
          version: 'v1',
          payload: event.payload,
        }, 'Scheme', schemeId);
      }, tenantId);
      this.logger.info('Scheme persisted and outbox event registered in transaction');
    }

    return { schemeId };
  }
}
