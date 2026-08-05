import { test, describe } from 'node:test';
import assert from 'node:assert';
import { PostgresDatabaseClient, InMemoryDriver } from '@dms/pkg-database';
import { LedgerAccount } from './domain/entities/ledger-account.entity.js';
import { LedgerPeriod } from './domain/entities/ledger-period.entity.js';
import { LedgerEntry } from './domain/entities/ledger-entry.entity.js';
import { LedgerPosting } from './domain/entities/ledger-posting.entity.js';
import { LedgerEntryAggregate, CreditLimitExceededError } from './domain/aggregates/ledger-entry.aggregate.js';
import { LedgerRepository, AgingReportBucket } from './domain/repositories/ledger.repository.js';
import { PostLedgerEntryUseCase } from './application/usecases/post-ledger-entry.usecase.js';
import { ReverseLedgerEntryUseCase } from './application/usecases/reverse-ledger-entry.usecase.js';

describe('Finance Service - Unit Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const cashAccountId = 'acc-cash-1111';
  const revenueAccountId = 'acc-rev-2222';

  describe('LedgerEntryAggregate - Business Logic & Invariants', () => {
    test('Should throw error if postings are empty or less than 2', () => {
      const entry = new LedgerEntry({
        tenantId,
        referenceType: 'MANUAL',
        referenceId: 'ref-1',
        postings: []
      });
      const agg = new LedgerEntryAggregate(entry);
      assert.throws(() => agg.validateInvariants(), /Ledger entry must contain at least one posting/);

      const entryOnePosting = new LedgerEntry({
        tenantId,
        referenceType: 'MANUAL',
        referenceId: 'ref-1',
        postings: [
          new LedgerPosting({ id: 'p1', tenantId, accountId: cashAccountId, type: 'DEBIT', amount: 100 })
        ]
      });
      const aggOne = new LedgerEntryAggregate(entryOnePosting);
      assert.throws(() => aggOne.validateInvariants(), /Double-entry ledger requires at least two postings/);
    });

    test('Should throw error if total debits do not equal total credits', () => {
      const entry = new LedgerEntry({
        tenantId,
        referenceType: 'MANUAL',
        referenceId: 'ref-1',
        postings: [
          new LedgerPosting({ id: 'p1', tenantId, accountId: cashAccountId, type: 'DEBIT', amount: 100 }),
          new LedgerPosting({ id: 'p2', tenantId, accountId: revenueAccountId, type: 'CREDIT', amount: 90 })
        ]
      });
      const agg = new LedgerEntryAggregate(entry);
      assert.throws(() => agg.validateInvariants(), /Double-entry ledger is out of balance/);
    });

    test('Should validate credit limit checks', () => {
      const period = new LedgerPeriod({
        id: 'period-1',
        tenantId,
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-30'),
        status: 'OPEN'
      });

      const cashAccount = new LedgerAccount({
        id: cashAccountId,
        tenantId,
        accountNumber: '1000',
        name: 'Cash',
        type: 'ASSET',
        balance: 500,
        creditLimit: 600 // creditLimit 600 for ASSET means balance cannot exceed 600
      });

      const revenueAccount = new LedgerAccount({
        id: revenueAccountId,
        tenantId,
        accountNumber: '4000',
        name: 'Revenue',
        type: 'REVENUE',
        balance: -500 // Credit balances are negative
      });

      const accounts = new Map<string, LedgerAccount>([
        [cashAccountId, cashAccount],
        [revenueAccountId, revenueAccount]
      ]);

      // Attempt debiting 200 (attempted cash balance 500 + 200 = 700 > 600)
      const entry = new LedgerEntry({
        tenantId,
        referenceType: 'MANUAL',
        referenceId: 'ref-1',
        postedAt: new Date('2026-06-15'),
        postings: [
          new LedgerPosting({ id: 'p1', tenantId, accountId: cashAccountId, type: 'DEBIT', amount: 200 }),
          new LedgerPosting({ id: 'p2', tenantId, accountId: revenueAccountId, type: 'CREDIT', amount: 200 })
        ]
      });

      const agg = new LedgerEntryAggregate(entry);
      assert.throws(() => agg.validate(period, accounts), CreditLimitExceededError);
    });

    test('Should throw error if period is closed or date is outside period', () => {
      const periodClosed = new LedgerPeriod({
        id: 'period-1',
        tenantId,
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-30'),
        status: 'CLOSED'
      });

      const cashAccount = new LedgerAccount({
        id: cashAccountId,
        tenantId,
        accountNumber: '1000',
        name: 'Cash',
        type: 'ASSET',
        balance: 0
      });

      const revenueAccount = new LedgerAccount({
        id: revenueAccountId,
        tenantId,
        accountNumber: '4000',
        name: 'Revenue',
        type: 'REVENUE',
        balance: 0
      });

      const accounts = new Map<string, LedgerAccount>([
        [cashAccountId, cashAccount],
        [revenueAccountId, revenueAccount]
      ]);

      const entry = new LedgerEntry({
        tenantId,
        referenceType: 'MANUAL',
        referenceId: 'ref-1',
        postedAt: new Date('2026-06-15'),
        postings: [
          new LedgerPosting({ id: 'p1', tenantId, accountId: cashAccountId, type: 'DEBIT', amount: 100 }),
          new LedgerPosting({ id: 'p2', tenantId, accountId: revenueAccountId, type: 'CREDIT', amount: 100 })
        ]
      });

      const agg = new LedgerEntryAggregate(entry);
      assert.throws(() => agg.validate(periodClosed, accounts), /Accounting period for date .* is CLOSED/);

      // Period open but date is outside
      const periodOpen = new LedgerPeriod({
        id: 'period-2',
        tenantId,
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-30'),
        status: 'OPEN'
      });
      const entryOutside = new LedgerEntry({
        tenantId,
        referenceType: 'MANUAL',
        referenceId: 'ref-1',
        postedAt: new Date('2026-07-01'),
        postings: [
          new LedgerPosting({ id: 'p1', tenantId, accountId: cashAccountId, type: 'DEBIT', amount: 100 }),
          new LedgerPosting({ id: 'p2', tenantId, accountId: revenueAccountId, type: 'CREDIT', amount: 100 })
        ]
      });
      const aggOutside = new LedgerEntryAggregate(entryOutside);
      assert.throws(() => aggOutside.validate(periodOpen, accounts), /The period does not contain entry date/);
    });
  });

  describe('Use Cases - In-Memory Tests', () => {
    class MockLedgerRepository implements LedgerRepository {
      accounts = new Map<string, LedgerAccount>();
      periods = new Map<string, LedgerPeriod>();
      entries = new Map<string, LedgerEntry>();

      async findAccountById(id: string, tenantId: string): Promise<LedgerAccount | null> {
        return this.accounts.get(id) || null;
      }
      async findAccountByNumber(accountNumber: string, tenantId: string): Promise<LedgerAccount | null> {
        for (const a of this.accounts.values()) {
          if (a.accountNumber === accountNumber) return a;
        }
        return null;
      }
      async saveAccount(account: LedgerAccount, tenantId: string): Promise<LedgerAccount> {
        this.accounts.set(account.id, account);
        return account;
      }
      async updateAccount(account: LedgerAccount, tenantId: string): Promise<LedgerAccount> {
        this.accounts.set(account.id, account);
        return account;
      }

      async findPeriodByDate(date: Date, tenantId: string): Promise<LedgerPeriod | null> {
        for (const p of this.periods.values()) {
          if (p.contains(date)) return p;
        }
        return null;
      }
      async savePeriod(period: LedgerPeriod, tenantId: string): Promise<LedgerPeriod> {
        this.periods.set(period.id, period);
        return period;
      }
      async updatePeriod(period: LedgerPeriod, tenantId: string): Promise<LedgerPeriod> {
        this.periods.set(period.id, period);
        return period;
      }

      async saveEntry(entry: LedgerEntry, tenantId: string): Promise<LedgerEntry> {
        this.entries.set(entry.id, entry);
        // Update account balances!
        for (const posting of entry.postings) {
          const account = this.accounts.get(posting.accountId);
          if (account) {
            const change = posting.type === 'DEBIT' ? posting.amount : -posting.amount;
            account.balance += change;
          }
        }
        return entry;
      }
      async findEntryById(id: string, tenantId: string): Promise<LedgerEntry | null> {
        return this.entries.get(id) || null;
      }
      async findEntryByRef(refType: string, refId: string, tenantId: string): Promise<LedgerEntry | null> {
        for (const e of this.entries.values()) {
          if (e.referenceType === refType && e.referenceId === refId) return e;
        }
        return null;
      }
      async updateEntry(entry: LedgerEntry, tenantId: string): Promise<LedgerEntry> {
        this.entries.set(entry.id, entry);
        return entry;
      }

      async getTrialBalance(tenantId: string): Promise<{ accountNumber: string; name: string; balance: number }[]> {
        return Array.from(this.accounts.values()).map(a => ({
          accountNumber: a.accountNumber,
          name: a.name,
          balance: a.balance
        }));
      }
      async getOutstandingAging(tenantId: string): Promise<Record<string, AgingReportBucket>> {
        return {};
      }
    }

    test('PostLedgerEntryUseCase and ReverseLedgerEntryUseCase execution flow', async () => {
      const repo = new MockLedgerRepository();
      const db = new PostgresDatabaseClient(new InMemoryDriver());

      // Seed Period and Accounts
      await repo.savePeriod(new LedgerPeriod({
        id: 'p1',
        tenantId,
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-30'),
        status: 'OPEN'
      }), tenantId);

      await repo.savePeriod(new LedgerPeriod({
        id: 'p2',
        tenantId,
        startDate: new Date('2026-07-01'),
        endDate: new Date('2026-07-31'),
        status: 'OPEN'
      }), tenantId);

      await repo.saveAccount(new LedgerAccount({
        id: cashAccountId,
        tenantId,
        accountNumber: '1000',
        name: 'Cash',
        type: 'ASSET',
        balance: 1000
      }), tenantId);

      await repo.saveAccount(new LedgerAccount({
        id: revenueAccountId,
        tenantId,
        accountNumber: '4000',
        name: 'Revenue',
        type: 'REVENUE',
        balance: -1000
      }), tenantId);

      // Post Entry
      const postUseCase = new PostLedgerEntryUseCase(db, repo);
      const postRes = await postUseCase.execute(tenantId, {
        referenceType: 'ORDER',
        referenceId: 'order-123',
        description: 'Customer order payment',
        postedAt: new Date('2026-06-10'),
        idempotencyKey: 'idemp-key-1',
        postings: [
          { accountId: cashAccountId, type: 'DEBIT', amount: 200 },
          { accountId: revenueAccountId, type: 'CREDIT', amount: 200 }
        ]
      });

      assert.ok(postRes.entryId);
      const savedEntry = await repo.findEntryById(postRes.entryId, tenantId);
      assert.strictEqual(savedEntry?.status, 'POSTED');
      
      const cashAcc = await repo.findAccountById(cashAccountId, tenantId);
      const revAcc = await repo.findAccountById(revenueAccountId, tenantId);
      assert.strictEqual(cashAcc?.balance, 1200); // 1000 + 200
      assert.strictEqual(revAcc?.balance, -1200); // -1000 - 200 (credits decrease balance / are negative)

      // Test Reversal
      const reverseUseCase = new ReverseLedgerEntryUseCase(db, repo);
      const reverseRes = await reverseUseCase.execute(tenantId, {
        entryId: postRes.entryId,
        reversalDescription: 'Customer order reversal',
        idempotencyKey: 'idemp-key-2'
      });

      assert.ok(reverseRes.reversalEntryId);
      const reversedOriginal = await repo.findEntryById(postRes.entryId, tenantId);
      assert.strictEqual(reversedOriginal?.status, 'REVERSED');

      const cashAccAfterRev = await repo.findAccountById(cashAccountId, tenantId);
      const revAccAfterRev = await repo.findAccountById(revenueAccountId, tenantId);
      assert.strictEqual(cashAccAfterRev?.balance, 1000); // back to 1000
      assert.strictEqual(revAccAfterRev?.balance, -1000); // back to -1000
    });
  });
});
