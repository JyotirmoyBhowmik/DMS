import { randomUUID } from 'node:crypto';
import { StructuredLogger, getCorrelation } from '@dms/pkg-logger';
import { PriceListEntity } from '../../domain/entities/price-list.entity.js';
import { PriceListAssignmentEntity } from '../../domain/entities/price-list-assignment.entity.js';
import { PricingAggregate } from '../../domain/aggregates/pricing.aggregate.js';
import { makeEnvelope, OutboxRepository } from '@dms/pkg-events';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { IPriceListRepository } from '../../domain/repositories/price-list.repository.js';
import { PriceListPgRepository } from '../../infrastructure/database/repositories/price-list.pg-repository.js';
import { TransactionalDbClient } from '../../infrastructure/database/transactional-client.js';
import { z } from 'zod';

export const CreatePriceListInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional(),
  assignments: z.array(z.object({
    id: z.string().uuid().optional(),
    assignmentType: z.enum(['default', 'channel', 'customer']),
    assignmentValue: z.string().optional(),
    priority: z.number().int().nonnegative().default(0),
  })).default([]),
});

export type CreatePriceListInput = z.infer<typeof CreatePriceListInputSchema>;

export class CreatePriceListUseCase {
  private logger = new StructuredLogger('CreatePriceListUseCase');
  private outboxRepo = new OutboxRepository({ tableName: 'pricing_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly priceListRepo?: IPriceListRepository,
  ) {}

  async execute(tenantId: string, input: CreatePriceListInput): Promise<{ priceListId: string }> {
    this.logger.info('Creating a new price list', { name: input.name });

    const parsed = CreatePriceListInputSchema.parse(input);
    const priceListId = parsed.id || randomUUID();

    const assignments = parsed.assignments.map(a => new PriceListAssignmentEntity({
      id: a.id || randomUUID(),
      tenantId,
      priceListId,
      assignmentType: a.assignmentType,
      assignmentValue: a.assignmentValue,
      priority: a.priority,
    }));

    const entity = new PriceListEntity({
      id: priceListId,
      tenantId,
      name: parsed.name,
      description: parsed.description,
      effectiveFrom: parsed.effectiveFrom,
      effectiveTo: parsed.effectiveTo,
      isActive: true,
      assignments,
      entries: [],
    });

    const aggregate = new PricingAggregate(entity);
    aggregate.validateInvariants();

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'price-list.created',
      'v1',
      {
        priceListId,
        name: entity.name,
        effectiveFrom: entity.effectiveFrom.toISOString(),
        effectiveTo: entity.effectiveTo?.toISOString(),
        assignments: assignments.map(a => ({
          assignmentType: a.assignmentType,
          assignmentValue: a.assignmentValue,
          priority: a.priority,
        })),
      },
      {
        tenantId,
        correlationId: activeCtx?.correlationId ?? 'correlation-uuid-mock',
        producer: 'pricing-service',
        partitionKey: priceListId,
        causationId: activeCtx?.causationId,
      }
    );

    if (this.db) {
      await this.db.transaction(async (conn) => {
        const txDb = new TransactionalDbClient(conn);
        const repo = this.priceListRepo || new PriceListPgRepository(txDb);

        // 1. Save price list
        await repo.save(entity, tenantId);

        // 2. Save assignments
        for (const assignment of assignments) {
          await repo.saveAssignment(assignment, tenantId);
        }

        // 3. Save outbox event
        await this.outboxRepo.save(conn, {
          eventId: event.eventId,
          tenantId,
          type: event.type,
          version: 'v1',
          payload: event.payload,
        }, 'PriceList', priceListId);
      }, tenantId);

      this.logger.info('Price list persisted and outbox event registered in transaction');
    } else if (this.priceListRepo) {
      await this.priceListRepo.save(entity, tenantId);
      for (const assignment of assignments) {
        await this.priceListRepo.saveAssignment(assignment, tenantId);
      }
    }

    return { priceListId };
  }
}
