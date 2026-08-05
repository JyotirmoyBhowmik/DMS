import { LedgerAccount } from '../entities/ledger-account.entity.js';
import { LedgerPeriod } from '../entities/ledger-period.entity.js';
import { LedgerEntry } from '../entities/ledger-entry.entity.js';

export interface AgingReportBucket {
  current: number;       // 0-30 days
  thirtyToSixty: number; // 31-60 days
  sixtyToNinety: number; // 61-90 days
  overNinety: number;    // >90 days
  total: number;
}

export interface LedgerRepository {
  findAccountById(id: string, tenantId: string): Promise<LedgerAccount | null>;
  findAccountByNumber(accountNumber: string, tenantId: string): Promise<LedgerAccount | null>;
  saveAccount(account: LedgerAccount, tenantId: string): Promise<LedgerAccount>;
  updateAccount(account: LedgerAccount, tenantId: string): Promise<LedgerAccount>;

  findPeriodByDate(date: Date, tenantId: string): Promise<LedgerPeriod | null>;
  savePeriod(period: LedgerPeriod, tenantId: string): Promise<LedgerPeriod>;
  updatePeriod(period: LedgerPeriod, tenantId: string): Promise<LedgerPeriod>;

  saveEntry(entry: LedgerEntry, tenantId: string): Promise<LedgerEntry>;
  findEntryById(id: string, tenantId: string): Promise<LedgerEntry | null>;
  findEntryByRef(refType: string, refId: string, tenantId: string): Promise<LedgerEntry | null>;
  updateEntry(entry: LedgerEntry, tenantId: string): Promise<LedgerEntry>;

  getTrialBalance(tenantId: string): Promise<{ accountNumber: string; name: string; balance: number }[]>;
  getOutstandingAging(tenantId: string): Promise<Record<string, AgingReportBucket>>;
}
