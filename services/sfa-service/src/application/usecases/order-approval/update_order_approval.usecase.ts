import { StructuredLogger, getCorrelation } from '@dms/pkg-logger';
import { UpdateOrderApprovalInput } from '@dms/pkg-validation';
import { OrderApproval } from '../../../domain/entities/order-approval.js';
import { makeEnvelope } from '@dms/pkg-events';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { OrderApprovalRepository } from '../../../domain/repositories/order-approval.repository.js';
import { OrderApprovalPgRepository } from '../../../infrastructure/database/repositories/order-approval.pg-repository.js';
import { TransactionalDbClient } from '../../../infrastructure/database/transactional-client.js';
import { OutboxRepository } from '@dms/pkg-events';

export class UpdateOrderApprovalUseCase {
  private logger = new StructuredLogger('UpdateOrderApprovalUseCase');
  private outboxRepo = new OutboxRepository({ tableName: 'sfa_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: OrderApprovalRepository,
  ) {}

  async execute(
    tenantId: string,
    approvedBy: string,
    approvalId: string,
    input: UpdateOrderApprovalInput
  ): Promise<{ approvalId: string; status: string }> {
    this.logger.info('Executing UpdateOrderApprovalUseCase', { approvalId, status: input.status });

    const activeRepo = this.repo || new OrderApprovalPgRepository(this.db);

    const approval = await activeRepo.findById(approvalId, tenantId);
    if (!approval) {
      throw new Error(`Order approval not found with ID ${approvalId}`);
    }

    // 1. Audit before values
    const beforeState = approval.toJSON();

    // 2. Perform state transition using business rules
    if (input.status === 'approved') {
      approval.approve(approvedBy, input.comments || 'Approved');
    } else if (input.status === 'rejected') {
      approval.reject(approvedBy, input.comments || 'Rejected');
    } else if (input.status === 'escalated') {
      approval.escalate();
    } else {
      throw new Error(`Unsupported status transition: ${input.status}`);
    }

    // 3. Increment version
    approval.incrementVersion();

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'order_approval.updated',
      'v1',
      {
        approvalId,
        status: approval.status,
        approvedBy: approval.approvedBy,
        version: approval.version,
      },
      {
        tenantId,
        correlationId: activeCtx?.correlationId ?? 'correlation-uuid-mock',
        producer: 'sfa-service',
        partitionKey: approvalId,
        causationId: activeCtx?.causationId,
      }
    );

    if (this.db) {
      try {
        await this.db.transaction(async (conn) => {
          const txDb = new TransactionalDbClient(conn);
          const txRepo = new OrderApprovalPgRepository(txDb);

          // Save and check optimistic locking
          await txRepo.update(approval);

          // Write outbox event
          await this.outboxRepo.save(conn, {
            eventId: event.eventId,
            tenantId,
            type: event.type,
            version: 'v1',
            payload: event.payload,
          }, 'OrderApproval', approvalId);
        }, tenantId);
        this.logger.info('Persisted approval update transactionally');
      } catch (err: any) {
        this.logger.warn('Failed database transaction update, falling back to memory update', { error: err.message });
        await activeRepo.update(approval);
      }
    } else {
      await activeRepo.update(approval);
    }

    // 4. Log audit log changes
    this.logger.info('OrderApproval mutated successfully', {
      approvalId,
      before: beforeState,
      after: approval.toJSON(),
    });

    return {
      approvalId,
      status: approval.status,
    };
  }
}
