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

export const UpdatePriceListInputSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  effectiveFrom: z.coerce.date().optional(),
  effectiveTo: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
  assignments: z.array(z.object({
    id: z.string().uuid().optional(),
    assignmentType: z.enum(['default', 'channel', 'customer']),
    assignmentValue: z.string().optional(),
    priority: z.number().int().nonnegative().default(0),
  })).optional(),
  version: z.number(),
});

export type UpdatePriceListInput = z.infer<typeof UpdatePriceListInputSchema>;

export class UpdatePriceListUseCase {
  private logger = new StructuredLogger('UpdatePriceListUseCase');
  private outboxRepo = new OutboxRepository({ tableName: 'pricing_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly priceListRepo?: IPriceListRepository,
  ) {}

  async execute(tenantId: string, priceListId: string, input: UpdatePriceListInput): Promise<PriceListEntity> {
    this.logger.info('Updating price list', { priceListId });

    const parsed = UpdatePriceListInputSchema.parse(input);

    if (!this.db) {
      throw new Error('Database client not configured');
    }

    let updatedEntity: PriceListEntity;

    await this.db.transaction(async (conn) => {
      const txDb = new TransactionalDbClient(conn);
      const repo = this.priceListRepo || new PriceListPgRepository(txDb);

      const existing = await repo.findById(priceListId, tenantId);

      // 1. Optimistic Locking check
      if (existing.version !== parsed.version) {
        throw new Error(`Concurrency check failed: version mismatch (expected ${existing.version}, got ${parsed.version})`);
      }

      // 2. Update fields
      if (parsed.name !== undefined) existing.name = parsed.name;
      if (parsed.description !== undefined) existing.description = parsed.description;
      if (parsed.effectiveFrom !== undefined) existing.effectiveFrom = parsed.effectiveFrom;
      if (parsed.effectiveTo !== undefined) existing.effectiveTo = parsed.effectiveTo;
      
      const oldIsActive = existing.isActive;
      if (parsed.isActive !== undefined) existing.isActive = parsed.isActive;

      // 3. Handle assignments replacement if provided
      let newAssignments: PriceListAssignmentEntity[] | undefined;
      if (parsed.assignments !== undefined) {
        newAssignments = parsed.assignments.map(a => new PriceListAssignmentEntity({
          id: a.id || randomUUID(),
          tenantId,
          priceListId,
          assignmentType: a.assignmentType,
          assignmentValue: a.assignmentValue,
          priority: a.priority,
        }));
        existing.assignments = newAssignments;
      }

      // 4. Validate Invariants
      const aggregate = new PricingAggregate(existing);
      aggregate.validateInvariants();

      // 5. Save update
      updatedEntity = await repo.update(existing, tenantId);

      // 6. Save new assignments (delete old ones first)
      if (newAssignments) {
        // Delete current assignments
        const oldAssignments = await repo.findAssignmentsForPriceList(priceListId, tenantId);
        for (const old of oldAssignments) {
          await repo.deleteAssignment(old.id, tenantId);
        }
        // Save new
        for (const assignment of newAssignments) {
          await repo.saveAssignment(assignment, tenantId);
        }
      }

      // 7. Publish events
      const activeCtx = getCorrelation();
      
      // Check if price list was activated
      const isActivated = parsed.isActive === true && !oldIsActive;
      const eventType = isActivated ? 'price-list.activated' : 'price-list.updated';

      const event = makeEnvelope(
        eventType,
        'v1',
        {
          priceListId,
          name: updatedEntity.name,
          effectiveFrom: updatedEntity.effectiveFrom.toISOString(),
          effectiveTo: updatedEntity.effectiveTo?.toISOString(),
          isActive: updatedEntity.isActive,
        },
        {
          tenantId,
          correlationId: activeCtx?.correlationId ?? 'correlation-uuid-mock',
          producer: 'pricing-service',
          partitionKey: priceListId,
          causationId: activeCtx?.causationId,
        }
      );

      await this.outboxRepo.save(conn, {
        eventId: event.eventId,
        tenantId,
        type: event.type,
        version: 'v1',
        payload: event.payload,
      }, 'PriceList', priceListId);

    }, tenantId);

    return updatedEntity!;
  }
}
