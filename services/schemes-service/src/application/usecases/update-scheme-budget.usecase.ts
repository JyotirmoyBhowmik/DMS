import { SchemeBudget } from '../../domain/entities/scheme_budget.js';
import { SchemeBudgetPgRepository } from '../../infrastructure/database/repositories/scheme_budget.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { UpdateSchemeBudgetDTO } from '@dms/pkg-validation';

export class UpdateSchemeBudgetUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });

  constructor(private budgetRepo: SchemeBudgetPgRepository) {}

  async execute(
    principal: Principal,
    id: string,
    dto: UpdateSchemeBudgetDTO
  ): Promise<SchemeBudget> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'scheme_budget:update')) {
      throw new Error('Forbidden: Insufficient permissions to update scheme budget');
    }

    // 2. Fetch existing entity
    const existing = await this.budgetRepo.findById(principal.tenantId, id);
    if (!existing || existing.tenantId !== principal.tenantId) {
      throw new Error(`SchemeBudget with ID ${id} not found`);
    }

    // 3. Optimistic locking check
    if (dto.version !== undefined && existing.version !== dto.version) {
      throw new Error('409 Conflict: Optimistic locking failure, version mismatch');
    }

    // 4. Apply budget utilization or status updates
    if (dto.utilizedCents !== undefined && dto.utilizedCents > existing.utilizedCents) {
      const delta = dto.utilizedCents - existing.utilizedCents;
      existing.recordUtilization(delta);
    }
    if (dto.status !== undefined) {
      existing.updateStatus(dto.status);
    }

    // 5. Persist updated aggregate
    await this.budgetRepo.save(existing);

    // 6. Record outbox event
    const eventEnvelope = makeEnvelope(
      'schemes.scheme_budget.status_updated',
      'v1',
      {
        budgetId: existing.id,
        budgetCode: existing.budgetCode,
        utilizedCents: existing.utilizedCents,
        status: existing.status,
        version: existing.version,
      },
      {
        tenantId: principal.tenantId,
        correlationId: principal.id,
        producer: 'schemes-service',
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
        'SchemeBudget',
        existing.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    return existing;
  }
}
