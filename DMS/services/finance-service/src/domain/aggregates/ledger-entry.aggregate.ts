import { LedgerEntry } from '../entities/ledger-entry.entity.js';
import { LedgerAccount } from '../entities/ledger-account.entity.js';
import { LedgerPeriod } from '../entities/ledger-period.entity.js';

export class CreditLimitExceededError extends Error {
  constructor(accountNumber: string, limit: number, attempted: number) {
    super(`Credit limit exceeded for account ${accountNumber}: limit is ${limit}, attempted balance is ${attempted}`);
    this.name = 'CreditLimitExceededError';
  }
}

export class LedgerEntryAggregate {
  private entry: LedgerEntry;

  constructor(entry: LedgerEntry) {
    this.entry = entry;
  }

  getEntry(): LedgerEntry {
    return this.entry;
  }

  validateInvariants(): void {
    if (!this.entry.tenantId) {
      throw new Error('Ledger entry tenantId is required');
    }
    if (!this.entry.referenceType || !this.entry.referenceId) {
      throw new Error('Ledger entry reference type and reference ID are required');
    }
    if (this.entry.postings.length === 0) {
      throw new Error('Ledger entry must contain at least one posting');
    }
    if (this.entry.postings.length < 2) {
      throw new Error('Double-entry ledger requires at least two postings');
    }

    let totalDebits = 0;
    let totalCredits = 0;

    for (const posting of this.entry.postings) {
      if (posting.amount <= 0) {
        throw new Error('Posting amount must be positive');
      }
      if (posting.tenantId !== this.entry.tenantId) {
        throw new Error('Posting tenant ID must match ledger entry tenant ID');
      }

      if (posting.type === 'DEBIT') {
        totalDebits += posting.amount;
      } else if (posting.type === 'CREDIT') {
        totalCredits += posting.amount;
      } else {
        throw new Error(`Invalid posting type: ${posting.type}`);
      }
    }

    if (totalDebits !== totalCredits) {
      throw new Error(`Double-entry ledger is out of balance. Total Debits: ${totalDebits}, Total Credits: ${totalCredits}`);
    }
  }

  validate(period: LedgerPeriod | null, accounts: Map<string, LedgerAccount>): void {
    // 1. Basic structural validation
    this.validateInvariants();

    // 2. Period safety check
    if (!period) {
      throw new Error(`No accounting period defined for the entry date ${this.entry.postedAt.toISOString()}`);
    }
    if (!period.isOpen()) {
      throw new Error(`Accounting period for date ${this.entry.postedAt.toISOString()} is CLOSED. Cannot post entries.`);
    }
    if (!period.contains(this.entry.postedAt)) {
      throw new Error(`The period does not contain entry date ${this.entry.postedAt.toISOString()}`);
    }

    // 3. Account presence and credit limit checks
    for (const posting of this.entry.postings) {
      const account = accounts.get(posting.accountId);
      if (!account) {
        throw new Error(`Account ${posting.accountId} not found in this tenant`);
      }
      if (account.tenantId !== this.entry.tenantId) {
        throw new Error(`Account ${account.accountNumber} does not belong to the entry tenant`);
      }
      if (account.closedAt) {
        throw new Error(`Account ${account.accountNumber} is closed and cannot receive postings`);
      }

      // Calculate what the new balance would be
      const change = posting.type === 'DEBIT' ? posting.amount : -posting.amount;
      const newBalance = account.balance + change;

      // Credit limit check
      if (account.creditLimit > 0) {
        if (account.type === 'ASSET' && newBalance > account.creditLimit) {
          throw new CreditLimitExceededError(account.accountNumber, account.creditLimit, newBalance);
        } else if (account.type === 'LIABILITY' && -newBalance > account.creditLimit) {
          throw new CreditLimitExceededError(account.accountNumber, account.creditLimit, -newBalance);
        }
      }
    }
  }
}
