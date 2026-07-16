import { MessageBrokerClient } from '@dms/pkg-events';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { StructuredLogger } from '@dms/pkg-logger';
import { PostLedgerEntryUseCase } from '../../application/usecases/post-ledger-entry.usecase.js';
import { LedgerPgRepository } from '../../infrastructure/database/repositories/ledger.pg-repository.js';
import { TransactionalDbClient } from '../../infrastructure/database/transactional-client.js';
import { LedgerAccount } from '../../domain/entities/ledger-account.entity.js';

export class FinanceEventConsumer {
  private logger = new StructuredLogger('FinanceEventConsumer');
  private postUseCase: PostLedgerEntryUseCase;

  constructor(
    private readonly db: PostgresDatabaseClient,
    private readonly broker: MessageBrokerClient,
  ) {
    this.postUseCase = new PostLedgerEntryUseCase(db);
  }

  start(): void {
    this.logger.info('Subscribing to finance inbound events');
    
    this.broker.subscribe('order.placed.v1', async (event: any) => {
      try {
        await this.handleOrderPlaced(event);
      } catch (err: any) {
        this.logger.error('Error in order.placed.v1 subscriber', { error: err.message });
        throw err;
      }
    }, {
      queueName: 'finance-service.order.placed',
      consumerGroup: 'finance-service',
    });

    this.broker.subscribe('claim.created.v1', async (event: any) => {
      try {
        await this.handleClaimCreated(event);
      } catch (err: any) {
        this.logger.error('Error in claim.created.v1 subscriber', { error: err.message });
        throw err;
      }
    }, {
      queueName: 'finance-service.claim.created',
      consumerGroup: 'finance-service',
    });

    this.broker.subscribe('scheme.allocated.v1', async (event: any) => {
      try {
        await this.handleSchemeAllocated(event);
      } catch (err: any) {
        this.logger.error('Error in scheme.allocated.v1 subscriber', { error: err.message });
        throw err;
      }
    }, {
      queueName: 'finance-service.scheme.allocated',
      consumerGroup: 'finance-service',
    });
  }

  private async isEventProcessed(eventId: string, tenantId: string): Promise<boolean> {
    const checkSql = 'SELECT result FROM finance_processed_events WHERE tenant_id = $1 AND event_id = $2 LIMIT 1';
    const checkResult = await this.db.query(checkSql, [tenantId, eventId], tenantId);
    return checkResult.rows.length > 0 && checkResult.rows[0].result === 'SUCCESS';
  }

  private async markEventProcessed(eventId: string, tenantId: string, eventType: string, sourceService: string, aggregateId: string): Promise<void> {
    const insertSql = 'INSERT INTO finance_processed_events (event_id, tenant_id, event_type, source_service, aggregate_id, result) VALUES ($1, $2, $3, $4, $5, \'SUCCESS\') ON CONFLICT (tenant_id, event_id) DO UPDATE SET result = \'SUCCESS\', processed_at = NOW(), error_message = NULL';
    await this.db.query(insertSql, [eventId, tenantId, eventType, sourceService, aggregateId], tenantId);
  }

  private async getOrCreateAccount(repo: LedgerPgRepository, accountNumber: string, name: string, type: \'ASSET\' | \'LIABILITY\' | \'EQUITY\' | \'REVENUE\' | \'EXPENSE\', tenantId: string): Promise<LedgerAccount> {
    let account = await repo.findAccountByNumber(accountNumber, tenantId);
    if (!account) {
      account = new LedgerAccount({
        tenantId,
        accountNumber,
        name,
        type,
        balance: 0,
        creditLimit: 0,
        version: 1,
      });
      account = await repo.saveAccount(account, tenantId);
    }
    return account;
  }

  private async handleOrderPlaced(event: any): Promise<void> {
    const { eventId, tenantId, eventType } = event;
    const payload = event.payload;
    
    if (!tenantId || !eventId) {
      throw new Error('Inbound event lacks tenantId or eventId');
    }

    const { orderId, outletId, distributorId, totalAmount } = payload;
    if (!orderId || !outletId || !distributorId) {
      throw new Error('Inbound order.placed event payload is missing required fields');
    }

    if (await this.isEventProcessed(eventId, tenantId)) {
      this.logger.warn('Event already processed. Skipping.', { eventId, eventType });
      return;
    }

    const amountDollars = Number(totalAmount) / 100;

    await this.db.transaction(async (conn) => {
      const txDb = new TransactionalDbClient(conn);
      const txRepo = new LedgerPgRepository(txDb);

      const arAcc = await this.getOrCreateAccount(txRepo, 'AR-' + outletId, 'Receivable - Outlet ' + outletId, 'ASSET', tenantId);
      const revAcc = await this.getOrCreateAccount(txRepo, 'REV-' + distributorId, 'Revenue - Distributor ' + distributorId, 'REVENUE', tenantId);

      await this.postUseCase.execute(tenantId, {
        referenceType: 'ORDER',
        referenceId: orderId,
        description: 'Order placement for order ' + orderId,
        idempotencyKey: 'order-placed-' + orderId,
        postings: [
          { accountId: arAcc.id, type: 'DEBIT', amount: amountDollars },
          { accountId: revAcc.id, type: 'CREDIT', amount: amountDollars },
        ],
      });
    }, tenantId);

    await this.markEventProcessed(eventId, tenantId, eventType, 'order-service', orderId);
    this.logger.info('Event processed and recorded in idempotency store successfully', { eventId, eventType });
  }

  private async handleClaimCreated(event: any): Promise<void> {
    const { eventId, tenantId, eventType } = event;
    const payload = event.payload;
    
    if (!tenantId || !eventId) {
      throw new Error('Inbound event lacks tenantId or eventId');
    }

    const { claimId, outletId, distributorId, amount } = payload;
    if (!claimId || !outletId || !distributorId) {
      throw new Error('Inbound claim.created event payload is missing required fields');
    }

    if (await this.isEventProcessed(eventId, tenantId)) {
      this.logger.warn('Event already processed. Skipping.', { eventId, eventType });
      return;
    }

    const amountDollars = Number(amount) / 100;

    await this.db.transaction(async (conn) => {
      const txDb = new TransactionalDbClient(conn);
      const txRepo = new LedgerPgRepository(txDb);

      const expAcc = await this.getOrCreateAccount(txRepo, 'EXP-CLAIMS-' + distributorId, 'Claims Expense - Distributor ' + distributorId, 'EXPENSE', tenantId);
      const arAcc = await this.getOrCreateAccount(txRepo, 'AR-' + outletId, 'Receivable - Outlet ' + outletId, 'ASSET', tenantId);

      await this.postUseCase.execute(tenantId, {
        referenceType: 'CLAIM',
        referenceId: claimId,
        description: 'Claim created for claim ' + claimId,
        idempotencyKey: 'claim-created-' + claimId,
        postings: [
          { accountId: expAcc.id, type: 'DEBIT', amount: amountDollars },
          { accountId: arAcc.id, type: 'CREDIT', amount: amountDollars },
        ],
      });
    }, tenantId);

    await this.markEventProcessed(eventId, tenantId, eventType, 'claim-service', claimId);
    this.logger.info('Event processed and recorded in idempotency store successfully', { eventId, eventType });
  }

  private async handleSchemeAllocated(event: any): Promise<void> {
    const { eventId, tenantId, eventType } = event;
    const payload = event.payload;
    
    if (!tenantId || !eventId) {
      throw new Error('Inbound event lacks tenantId or eventId');
    }

    const { schemeId, outletId, distributorId, discountAmount } = payload;
    if (!schemeId || !outletId || !distributorId) {
      throw new Error('Inbound scheme.allocated event payload is missing required fields');
    }

    if (await this.isEventProcessed(eventId, tenantId)) {
      this.logger.warn('Event already processed. Skipping.', { eventId, eventType });
      return;
    }

    const amountDollars = Number(discountAmount) / 100;

    await this.db.transaction(async (conn) => {
      const txDb = new TransactionalDbClient(conn);
      const txRepo = new LedgerPgRepository(txDb);

      const expAcc = await this.getOrCreateAccount(txRepo, 'EXP-SCHEMES-' + distributorId, 'Schemes Expense - Distributor ' + distributorId, 'EXPENSE', tenantId);
      const arAcc = await this.getOrCreateAccount(txRepo, 'AR-' + outletId, 'Receivable - Outlet ' + outletId, 'ASSET', tenantId);

      await this.postUseCase.execute(tenantId, {
        referenceType: 'SCHEME',
        referenceId: schemeId,
        description: 'Scheme allocation for scheme ' + schemeId,
        idempotencyKey: 'scheme-allocated-' + schemeId,
        postings: [
          { accountId: expAcc.id, type: 'DEBIT', amount: amountDollars },
          { accountId: arAcc.id, type: 'CREDIT', amount: amountDollars },
        ],
      });
    }, tenantId);

    await this.markEventProcessed(eventId, tenantId, eventType, 'scheme-service', schemeId);
    this.logger.info('Event processed and recorded in idempotency store successfully', { eventId, eventType });
  }
}
