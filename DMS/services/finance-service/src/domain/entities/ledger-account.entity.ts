export type LedgerAccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

export class LedgerAccount {
  id: string;
  tenantId: string;
  accountNumber: string;
  name: string;
  type: LedgerAccountType;
  balance: number; // Signed: debits are (+), credits are (-)
  creditLimit: number; // 0 means no limit
  version: number;
  createdAt?: Date;
  updatedAt?: Date;
  closedAt?: Date | null;

  constructor(data: Partial<LedgerAccount>) {
    this.id = data.id || '';
    this.tenantId = data.tenantId || '';
    this.accountNumber = data.accountNumber || '';
    this.name = data.name || '';
    this.type = data.type || 'ASSET';
    this.balance = data.balance || 0;
    this.creditLimit = data.creditLimit || 0;
    this.version = data.version || 1;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.closedAt = data.closedAt;
  }
}
