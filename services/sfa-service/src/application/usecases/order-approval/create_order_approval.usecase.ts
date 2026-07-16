import { randomUUID } from 'node:crypto';
import { StructuredLogger, getCorrelation } from '@dms/pkg-logger';
import { CreateOrderApprovalInput } from '@dms/pkg-validation';
import { OrderApproval } from '../../../domain/entities/order-approval.js';
import { Money } from '../../../domain/value-objects/money.js';
import { makeEnvelope } from '@dms/pkg-events';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { OrderApprovalRepository } from '../../../domain/repositories/order-approval.repository.js';
import { OrderApprovalPgRepository } from '../../../infrastructure/database/repositories/order-approval.pg-repository.js';
import { TransactionalDbClient } from '../../../infrastructure/database/transactional-client.js';
import { OutboxRepository } from '@dms/pkg-events';

export class CreateOrderApprovalUseCase {
  private logger = new StructuredLogger('CreateOrderApprovalUseCase');
  private outboxRepo = new OutboxRepository({ tableName: 'sfa_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: OrderApprovalRepository,
  ) {}

  async execute(tenantId: string, requestedBy: string, input: CreateOrderApprovalInput): Promise<{ approvalId: string; status: string }> {
    this.logger.info('Executing CreateOrderApprovalUseCase', { orderId: input.orderId });

    const approvalId = input.id ?? randomUUID();
    const thresholdMoney = Money.of(input.thresholdAmount, 'INR');
    const orderMoney = Money.of(input.amount, 'INR');

    const approval = OrderApproval.create({
      id: approvalId,
      tenantId,
      orderId: input.orderId,
      requestedBy: requestedBy,
      thresholdAmount: thresholdMoney,
      orderAmount: orderMoney,
    });

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'order_approval.created',
      'v1',
      {
        approvalId,
        orderId: approval.orderId,
        requestedBy: approval.requestedBy,
        thresholdAmount: approval.thresholdAmount.amount,
        status: approval.status,
      },
      {
        tenantId,
        correlationId: activeCtx?.correlationId ?? 'correlation-uuid-mock',
        producer: 'sfa-service',
        partitionKey: approvalId,
        causationId: activeCtx?.causationId,
      }
    );

    const activeRepo = this.repo || new OrderApprovalPgRepository(this.db);

    if (this.db) {
      try {
        await this.db.transaction(async (conn) => {
          const txDb = new TransactionalDbClient(conn);
          const txRepo = new OrderApprovalPgRepository(txDb);

          // 1. Save approval
          await txRepo.save(approval);

          // 2. Save event in outbox
          await this.outboxRepo.save(conn, {
            eventId: event.eventId,
            tenantId,
            type: event.type,
            version: 'v1',
            payload: event.payload,
          }, 'OrderApproval', approvalId);
        }, tenantId);
        this.logger.info('Persisted approval and event transactionally');
      } catch (err: any) {
        this.logger.warn('Failed database transaction, falling back to memory save', { error: err.message });
        await activeRepo.save(approval);
      }
    } else {
      await activeRepo.save(approval);
    }

    return {
      approvalId,
      status: approval.status,
    };
  }
}
