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

export interface ReverseLedgerEntryInput {
  entryId: string;
  reversalDescription: string;
  idempotencyKey: string;
}

export class ReverseLedgerEntryUseCase {
  private logger = new StructuredLogger('ReverseLedgerEntryUseCase');
  private outboxRepo = new OutboxRepository({ tableName: 'finance_outbox' });

  constructor(
    private readonly db: PostgresDatabaseClient,
    private readonly ledgerRepo?: LedgerRepository,
  ) {}

  async execute(tenantId: string, input: ReverseLedgerEntryInput): Promise<{ reversalEntryId: string }> {
    this.logger.info('Executing reverse ledger entry', { entryId: input.entryId });

    const reversalDate = new Date();
    const reversalEntryId = randomUUID();

    const result = await this.db.transaction(async (conn) => {
      const txDb = new TransactionalDbClient(conn);
      const txRepo = this.ledgerRepo || new LedgerPgRepository(txDb);

      // 1. Fetch original entry
      const originalEntry = await txRepo.findEntryById(input.entryId, tenantId);
      if (!originalEntry) {
        throw new Error(`Ledger entry to reverse not found: ${input.entryId}`);
      }

      // Idempotency: check if already reversed
      if (originalEntry.status === 'REVERSED') {
        const existingReversalSql = `
          SELECT id FROM ledger_entries
          WHERE tenant_id = $1 AND reversed_entry_id = $2
          LIMIT 1
        `;
        const existingReversalResult = await txDb.query<{ id: string }>(
          existingReversalSql,
          [tenantId, originalEntry.id]
        );
        if (existingReversalResult.rows.length > 0) {
          this.logger.info('Ledger entry already reversed (idempotent)', { originalEntryId: originalEntry.id, reversalEntryId: existingReversalResult.rows[0]!.id });
          return { reversalEntryId: existingReversalResult.rows[0]!.id };
        }
        throw new Error(`Ledger entry ${input.entryId} is already in REVERSED status, but no reversal entry was found.`);
      }

      // 2. Fetch accounting period for reversal date
      const period = await txRepo.findPeriodByDate(reversalDate, tenantId);

      // 3. Fetch accounts and populate map
      const accountsMap = new Map();
      for (const posting of originalEntry.postings) {
        if (!accountsMap.has(posting.accountId)) {
          const account = await txRepo.findAccountById(posting.accountId, tenantId);
          if (account) {
            accountsMap.set(posting.accountId, account);
          }
        }
      }

      // 4. Create inverse postings
      const reversalPostings = originalEntry.postings.map((origPosting: any) => new LedgerPosting({
        id: randomUUID(),
        tenantId,
        entryId: reversalEntryId,
        accountId: origPosting.accountId,
        type: origPosting.type === 'DEBIT' ? 'CREDIT' : 'DEBIT',
        amount: origPosting.amount,
      }));

      // 5. Construct reversal entry entity
      const reversalEntry = new LedgerEntry({
        id: reversalEntryId,
        tenantId,
        referenceType: 'REVERSAL',
        referenceId: originalEntry.id,
        description: input.reversalDescription,
        status: 'POSTED',
        reversedEntryId: originalEntry.id,
        postedAt: reversalDate,
        idempotencyKey: input.idempotencyKey,
        postings: reversalPostings,
        version: 1,
      });

      // 6. Validate reversal aggregate
      const aggregate = new LedgerEntryAggregate(reversalEntry);
      aggregate.validate(period, accountsMap);

      // 7. Save reversal entry (this inserts entry & postings, and updates account balances in DB)
      const savedReversal = await txRepo.saveEntry(reversalEntry, tenantId);

      // 8. Update status of the original entry to REVERSED
      originalEntry.status = 'REVERSED';
      await txRepo.updateEntry(originalEntry, tenantId);

      // 9. Save outbox event
      const correlation = getCorrelation();
      const event = makeEnvelope(
        'ledger.entry.reversed',
        'v1',
        {
          originalEntryId: originalEntry.id,
          reversalEntryId: savedReversal.id,
          description: savedReversal.description,
          postedAt: savedReversal.postedAt.toISOString(),
        },
        {
          tenantId,
          correlationId: correlation?.correlationId ?? randomUUID(),
          producer: 'finance-service',
          partitionKey: savedReversal.id,
          causationId: correlation?.causationId,
        }
      );

      await this.outboxRepo.save(conn, {
        eventId: event.eventId,
        tenantId,
        type: event.type,
        version: 'v1',
        payload: event.payload,
      }, 'LedgerEntry', savedReversal.id);

      return { reversalEntryId: savedReversal.id };
    }, tenantId);

    return result;
  }
}
