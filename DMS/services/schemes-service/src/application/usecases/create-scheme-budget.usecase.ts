import { SchemeBudget } from '../../domain/entities/scheme_budget.js';
import { SchemeBudgetPgRepository } from '../../infrastructure/database/repositories/scheme_budget.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { CreateSchemeBudgetDTO } from '@dms/pkg-validation';
import { randomUUID } from 'node:crypto';

export class CreateSchemeBudgetUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });
  private static idempotencyStore = new Map<string, SchemeBudget>();

  constructor(private budgetRepo: SchemeBudgetPgRepository) {}

  async execute(
    principal: Principal,
    dto: CreateSchemeBudgetDTO,
    idempotencyKey?: string
  ): Promise<SchemeBudget> {
    // 1. Authorize inside use case
    if (!RbacGuard.can(principal, 'scheme_budget:create')) {
      throw new Error('Forbidden: Insufficient permissions to create scheme budget');
    }

    // 2. Idempotency Key check
    if (idempotencyKey) {
      const cached = CreateSchemeBudgetUseCase.idempotencyStore.get(`${principal.tenantId}:${idempotencyKey}`);
      if (cached) {
        return cached;
      }
    }

    // 3. Uniqueness Check: Check budgetCode per scheme
    const existing = await this.budgetRepo.findByCode(principal.tenantId, dto.schemeId, dto.budgetCode);
    if (existing) {
      throw new Error(`409 Conflict: SchemeBudget with code ${dto.budgetCode} already exists for this scheme`);
    }

    // 4. Construct aggregate
    const budgetId = randomUUID();
    const budget = SchemeBudget.create({
      id: budgetId,
      tenantId: principal.tenantId,
      schemeId: dto.schemeId,
      name: dto.name,
      budgetCode: dto.budgetCode,
      totalAllocatedCents: dto.totalAllocatedCents,
      utilizedCents: dto.utilizedCents,
    });

    // 5. Persist to repository
    await this.budgetRepo.save(budget);

    // 6. Outbox event publication
    const eventEnvelope = makeEnvelope(
      'schemes.scheme_budget.created',
      'v1',
      {
        budgetId: budget.id,
        schemeId: budget.schemeId,
        name: budget.name,
        budgetCode: budget.budgetCode,
        totalAllocatedCents: budget.totalAllocatedCents,
        status: budget.status,
      },
      {
        tenantId: principal.tenantId,
        correlationId: principal.id,
        producer: 'schemes-service',
        partitionKey: budget.id,
      }
    );

    try {
      await this.outboxRepo.save(
        null as any,
        {
          eventId: eventEnvelope.eventId,
          tenantId: budget.tenantId,
          type: eventEnvelope.type,
          version: 'v1',
          payload: eventEnvelope.payload,
        },
        'SchemeBudget',
        budget.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    if (idempotencyKey) {
      CreateSchemeBudgetUseCase.idempotencyStore.set(`${principal.tenantId}:${idempotencyKey}`, budget);
    }

    return budget;
  }
}
