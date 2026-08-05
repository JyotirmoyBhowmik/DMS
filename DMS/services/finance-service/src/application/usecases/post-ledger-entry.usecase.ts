import { randomUUID } from 'node:crypto';
import { StructuredLogger, getCorrelation } from '@dms/pkg-logger';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { makeEnvelope, OutboxRepository } from '@dms/pkg-events';
import { LedgerEntry } from '../../domain/entities/ledger-entry.entity.js';
import { LedgerPosting } from '../../domain/entities/ledger-posting.entity.js';
import { LedgerEntryAggregate } from '../../domain/aggregates/ledger-entry.aggregate.js';
import { LedgerRepository } from '../../domain/repositories/ledger.repository.js';
import { LedgerPgRepository } from '../../infrastructure/database/repositories/ledger.pg-repository.js';
import { TransactionalDbClient } from '../../infrastructure/database/transactional-client.js';

export interface PostLedgerEntryInput {
  referenceType: string;
  referenceId: string;
  description: string;
  postedAt?: Date;
  idempotencyKey: string;
  postings: Array<{
    accountId: string;
    type: 'DEBIT' | 'CREDIT';
    amount: number;
  }>;
}

export class PostLedgerEntryUseCase {
  private logger = new StructuredLogger('PostLedgerEntryUseCase');
  private outboxRepo = new OutboxRepository({ tableName: 'finance_outbox' });

  constructor(
    private readonly db: PostgresDatabaseClient,
    private readonly ledgerRepo?: LedgerRepository,
  ) {}

  async execute(tenantId: string, input: PostLedgerEntryInput): Promise<{ entryId: string }> {
    this.logger.info('Executing post ledger entry', { referenceType: input.referenceType, referenceId: input.referenceId });

    const postedAt = input.postedAt || new Date();
    const entryId = randomUUID();

    // Run in database transaction
    const result = await this.db.transaction(async (conn) => {
      const txDb = new TransactionalDbClient(conn);
      const txRepo = this.ledgerRepo || new LedgerPgRepository(txDb);

      // 1. Idempotency Check
      const existing = await txRepo.findEntryByRef(input.referenceType, input.referenceId, tenantId);
      if (existing) {
        this.logger.info('Ledger entry already exists (idempotent)', { entryId: existing.id });
        return { entryId: existing.id };
      }

      // 2. Fetch accounting period
      const period = await txRepo.findPeriodByDate(postedAt, tenantId);

      // 3. Fetch accounts and populate map
      const accountsMap = new Map();
      for (const posting of input.postings) {
        if (!accountsMap.has(posting.accountId)) {
          const account = await txRepo.findAccountById(posting.accountId, tenantId);
          if (account) {
            accountsMap.set(posting.accountId, account);
          }
        }
      }

      // 4. Construct entry and posting entities
      const postings = input.postings.map(p => new LedgerPosting({
        id: randomUUID(),
        tenantId,
        entryId,
        accountId: p.accountId,
        type: p.type,
        amount: p.amount,
      }));

      const entryEntity = new LedgerEntry({
        id: entryId,
        tenantId,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        description: input.description,
        status: 'POSTED',
        postedAt,
        idempotencyKey: input.idempotencyKey,
        postings,
        version: 1,
      });

      // 5. Aggregate validation
      const aggregate = new LedgerEntryAggregate(entryEntity);
      aggregate.validate(period, accountsMap);

      // 6. Save Ledger Entry
      const saved = await txRepo.saveEntry(entryEntity, tenantId);

      // 7. Save outbox event
      const correlation = getCorrelation();
      const event = makeEnvelope(
        'ledger.entry.posted',
        'v1',
        {
          entryId: saved.id,
          referenceType: saved.referenceType,
          referenceId: saved.referenceId,
          description: saved.description,
          postedAt: saved.postedAt.toISOString(),
          postings: saved.postings.map((p: any) => ({
            accountId: p.accountId,
            type: p.type,
            amount: p.amount,
          })),
        },
        {
          tenantId,
          correlationId: correlation?.correlationId ?? randomUUID(),
          producer: 'finance-service',
          partitionKey: saved.id,
          causationId: correlation?.causationId,
        }
      );

      await this.outboxRepo.save(conn, {
        eventId: event.eventId,
        tenantId,
        type: event.type,
        version: 'v1',
        payload: event.payload,
      }, 'LedgerEntry', saved.id);

      return { entryId: saved.id };
    }, tenantId);

    return result;
  }
}
