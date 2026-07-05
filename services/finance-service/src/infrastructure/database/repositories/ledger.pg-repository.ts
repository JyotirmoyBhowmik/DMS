import { BasePostgresRepository, BaseRow, PostgresDatabaseClient } from '@dms/pkg-database';
import { LedgerRepository, AgingReportBucket } from '../../domain/repositories/ledger.repository.js';
import { LedgerAccount } from '../../domain/entities/ledger-account.entity.js';
import { LedgerPeriod } from '../../domain/entities/ledger-period.entity.js';
import { LedgerEntry } from '../../domain/entities/ledger-entry.entity.js';
import { LedgerPosting } from '../../domain/entities/ledger-posting.entity.js';

// ─── Sub-Repositories ─────────────────────────────────────────────────────────

class AccountPgRepository extends BasePostgresRepository<LedgerAccount> {
  protected tableName(): string {
    return 'ledger_accounts';
  }

  protected mapToEntity(row: BaseRow): LedgerAccount {
    return new LedgerAccount({
      id: row.id,
      tenantId: row.tenant_id,
      accountNumber: row.account_number as string,
      name: row.name as string,
      type: row.type as any,
      balance: Number(row.balance) / 100,
      creditLimit: Number(row.credit_limit) / 100,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      closedAt: row.closed_at ? new Date(row.closed_at as string) : null,
    });
  }

  protected mapToRow(entity: LedgerAccount): BaseRow {
    return {
      id: entity.id,
      tenant_id: entity.tenantId,
      account_number: entity.accountNumber,
      name: entity.name,
      type: entity.type,
      balance: Math.round(entity.balance * 100),
      credit_limit: Math.round(entity.creditLimit * 100),
      version: entity.version,
      created_at: entity.createdAt || new Date(),
      updated_at: entity.updatedAt || new Date(),
      closed_at: entity.closedAt || null,
    };
  }
}

class PeriodPgRepository extends BasePostgresRepository<LedgerPeriod> {
  protected tableName(): string {
    return 'ledger_periods';
  }

  protected mapToEntity(row: BaseRow): LedgerPeriod {
    return new LedgerPeriod({
      id: row.id,
      tenantId: row.tenant_id,
      startDate: new Date(row.start_date as string),
      endDate: new Date(row.end_date as string),
      status: row.status as any,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  protected mapToRow(entity: LedgerPeriod): BaseRow {
    return {
      id: entity.id,
      tenant_id: entity.tenantId,
      start_date: entity.startDate,
      end_date: entity.endDate,
      status: entity.status,
      version: 1,
      created_at: entity.createdAt || new Date(),
      updated_at: entity.updatedAt || new Date(),
    };
  }
}

class EntryPgRepository extends BasePostgresRepository<LedgerEntry> {
  protected tableName(): string {
    return 'ledger_entries';
  }

  protected mapToEntity(row: BaseRow): LedgerEntry {
    return new LedgerEntry({
      id: row.id,
      tenantId: row.tenant_id,
      referenceType: row.reference_type as string,
      referenceId: row.reference_id as string,
      description: row.description as string,
      status: row.status as any,
      reversedEntryId: row.reversed_entry_id as string | null,
      postedAt: row.posted_at as Date,
      idempotencyKey: row.idempotency_key as string,
      version: row.version,
      postings: [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  protected mapToRow(entity: LedgerEntry): BaseRow {
    return {
      id: entity.id,
      tenant_id: entity.tenantId,
      reference_type: entity.referenceType,
      reference_id: entity.referenceId,
      description: entity.description,
      status: entity.status,
      reversed_entry_id: entity.reversedEntryId || null,
      posted_at: entity.postedAt,
      idempotency_key: entity.idempotencyKey,
      version: entity.version,
      created_at: entity.createdAt || new Date(),
      updated_at: entity.updatedAt || new Date(),
    };
  }
}

// ─── Unified Ledger Pg Repository ─────────────────────────────────────────────

export class LedgerPgRepository implements LedgerRepository {
  private accountRepo: AccountPgRepository;
  private periodRepo: PeriodPgRepository;
  private entryRepo: EntryPgRepository;

  constructor(private readonly db: PostgresDatabaseClient) {
    this.accountRepo = new AccountPgRepository(db);
    this.periodRepo = new PeriodPgRepository(db);
    this.entryRepo = new EntryPgRepository(db);
  }

  // ── Account Operations ──

  async findAccountById(id: string, tenantId: string): Promise<LedgerAccount | null> {
    try {
      return await this.accountRepo.findById(id, tenantId);
    } catch {
      return null;
    }
  }

  async findAccountByNumber(accountNumber: string, tenantId: string): Promise<LedgerAccount | null> {
    const sql = `SELECT * FROM ledger_accounts WHERE tenant_id = $1 AND account_number = $2 LIMIT 1`;
    const result = await this.db.query<BaseRow>(sql, [tenantId, accountNumber], tenantId);
    if (result.rows.length === 0) return null;
    return (this.accountRepo as any).mapToEntity(result.rows[0]);
  }

  async saveAccount(account: LedgerAccount, tenantId: string): Promise<LedgerAccount> {
    return await this.accountRepo.save(account, tenantId);
  }

  async updateAccount(account: LedgerAccount, tenantId: string): Promise<LedgerAccount> {
    return await this.accountRepo.update(account, tenantId);
  }

  // ── Period Operations ──

  async findPeriodByDate(date: Date, tenantId: string): Promise<LedgerPeriod | null> {
    const sql = `
      SELECT * FROM ledger_periods
      WHERE tenant_id = $1 AND start_date <= $2 AND end_date >= $2
      LIMIT 1
    `;
    const result = await this.db.query<BaseRow>(sql, [tenantId, date], tenantId);
    if (result.rows.length === 0) return null;
    return (this.periodRepo as any).mapToEntity(result.rows[0]);
  }

  async savePeriod(period: LedgerPeriod, tenantId: string): Promise<LedgerPeriod> {
    return await this.periodRepo.save(period, tenantId);
  }

  async updatePeriod(period: LedgerPeriod, tenantId: string): Promise<LedgerPeriod> {
    return await this.periodRepo.update(period, tenantId);
  }

  // ── Entry Operations ──

  async saveEntry(entry: LedgerEntry, tenantId: string): Promise<LedgerEntry> {
    // 1. Save entry row
    const savedEntry = await this.entryRepo.save(entry, tenantId);

    // 2. Save postings and update account balances
    const savedPostings: LedgerPosting[] = [];
    for (const posting of entry.postings) {
      const postingId = posting.id || crypto.randomUUID();
      const insertPostingSql = `
        INSERT INTO ledger_postings (id, tenant_id, entry_id, account_id, type, amount, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *
      `;
      const postingAmountCents = Math.round(posting.amount * 100);
      const postingResult = await this.db.query<any>(
        insertPostingSql,
        [postingId, tenantId, savedEntry.id, posting.accountId, posting.type, postingAmountCents],
        tenantId
      );

      const dbPosting = postingResult.rows[0];
      savedPostings.push(new LedgerPosting({
        id: dbPosting.id,
        tenantId: dbPosting.tenant_id,
        entryId: dbPosting.entry_id,
        accountId: dbPosting.account_id,
        type: dbPosting.type,
        amount: Number(dbPosting.amount) / 100,
        createdAt: dbPosting.created_at,
      }));

      // Update account balance: DEBIT increases (+), CREDIT decreases (-)
      const balanceChange = posting.type === 'DEBIT' ? postingAmountCents : -postingAmountCents;
      const updateAccountSql = `
        UPDATE ledger_accounts
        SET balance = balance + $1, updated_at = NOW()
        WHERE id = $2 AND tenant_id = $3
      `;
      await this.db.query(updateAccountSql, [balanceChange, posting.accountId, tenantId], tenantId);
    }

    savedEntry.postings = savedPostings;
    return savedEntry;
  }

  async findEntryById(id: string, tenantId: string): Promise<LedgerEntry | null> {
    try {
      const entry = await this.entryRepo.findById(id, tenantId);
      entry.postings = await this.fetchPostingsForEntry(entry.id, tenantId);
      return entry;
    } catch {
      return null;
    }
  }

  async findEntryByRef(refType: string, refId: string, tenantId: string): Promise<LedgerEntry | null> {
    const sql = `
      SELECT * FROM ledger_entries
      WHERE tenant_id = $1 AND reference_type = $2 AND reference_id = $3
      LIMIT 1
    `;
    const result = await this.db.query<BaseRow>(sql, [tenantId, refType, refId], tenantId);
    if (result.rows.length === 0) return null;
    const entry = (this.entryRepo as any).mapToEntity(result.rows[0]);
    entry.postings = await this.fetchPostingsForEntry(entry.id, tenantId);
    return entry;
  }

  async updateEntry(entry: LedgerEntry, tenantId: string): Promise<LedgerEntry> {
    const updated = await this.entryRepo.update(entry, tenantId);
    updated.postings = await this.fetchPostingsForEntry(updated.id, tenantId);
    return updated;
  }

  // ── Reports ──

  async getTrialBalance(tenantId: string): Promise<{ accountNumber: string; name: string; balance: number }[]> {
    const sql = `
      SELECT account_number, name, balance FROM ledger_accounts
      WHERE tenant_id = $1
      ORDER BY account_number ASC
    `;
    const result = await this.db.query<{ account_number: string; name: string; balance: string }>(sql, [tenantId], tenantId);
    return result.rows.map(row => ({
      accountNumber: row.account_number,
      name: row.name,
      balance: Number(row.balance) / 100,
    }));
  }

  async getOutstandingAging(tenantId: string): Promise<Record<string, AgingReportBucket>> {
    const accountsSql = `
      SELECT id, account_number, name, balance FROM ledger_accounts
      WHERE tenant_id = $1 AND type = 'ASSET'
    `;
    const accountsResult = await this.db.query<{ id: string; account_number: string; name: string; balance: string }>(
      accountsSql, [tenantId], tenantId
    );

    const agingReport: Record<string, AgingReportBucket> = {};

    for (const account of accountsResult.rows) {
      const balance = Number(account.balance) / 100;
      if (balance <= 0) {
        agingReport[account.account_number] = {
          current: 0,
          thirtyToSixty: 0,
          sixtyToNinety: 0,
          overNinety: 0,
          total: balance,
        };
        continue;
      }

      const postingsSql = `
        SELECT p.type, p.amount, e.posted_at
        FROM ledger_postings p
        JOIN ledger_entries e ON p.entry_id = e.id
        WHERE p.account_id = $1 AND p.tenant_id = $2
        ORDER BY e.posted_at ASC, p.created_at ASC
      `;
      const postingsResult = await this.db.query<{ type: string; amount: string; posted_at: string }>(
        postingsSql, [account.id, tenantId], tenantId
      );

      const debits: { amount: number; date: Date }[] = [];

      for (const p of postingsResult.rows) {
        const amt = Number(p.amount) / 100;
        const date = new Date(p.posted_at);

        if (p.type === 'DEBIT') {
          debits.push({ amount: amt, date });
        } else {
          let creditAmt = amt;
          while (creditAmt > 0 && debits.length > 0) {
            const oldest = debits[0]!;
            if (oldest.amount <= creditAmt) {
              creditAmt -= oldest.amount;
              debits.shift();
            } else {
              oldest.amount -= creditAmt;
              creditAmt = 0;
            }
          }
        }
      }

      const now = new Date();
      let current = 0;
      let thirtyToSixty = 0;
      let sixtyToNinety = 0;
      let overNinety = 0;
      let total = 0;

      for (const d of debits) {
        const diffMs = now.getTime() - d.date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays <= 30) {
          current += d.amount;
        } else if (diffDays <= 60) {
          thirtyToSixty += d.amount;
        } else if (diffDays <= 90) {
          sixtyToNinety += d.amount;
        } else {
          overNinety += d.amount;
        }
        total += d.amount;
      }

      agingReport[account.account_number] = {
        current: Math.round(current * 100) / 100,
        thirtyToSixty: Math.round(thirtyToSixty * 100) / 100,
        sixtyToNinety: Math.round(sixtyToNinety * 100) / 100,
        overNinety: Math.round(overNinety * 100) / 100,
        total: Math.round(total * 100) / 100,
      };
    }

    return agingReport;
  }

  // ── Helpers ──

  private async fetchPostingsForEntry(entryId: string, tenantId: string): Promise<LedgerPosting[]> {
    const sql = `
      SELECT * FROM ledger_postings
      WHERE entry_id = $1 AND tenant_id = $2
      ORDER BY created_at ASC
    `;
    const result = await this.db.query<{ id: string; tenant_id: string; entry_id: string; account_id: string; type: string; amount: string; created_at: string }>(
      sql, [entryId, tenantId], tenantId
    );

    return result.rows.map(row => new LedgerPosting({
      id: row.id,
      tenantId: row.tenant_id,
      entryId: row.entry_id,
      accountId: row.account_id,
      type: row.type as any,
      amount: Number(row.amount) / 100,
      createdAt: new Date(row.created_at),
    }));
  }
}
