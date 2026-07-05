export type PostingType = 'DEBIT' | 'CREDIT';

export class LedgerPosting {
  id: string;
  tenantId: string;
  entryId: string;
  accountId: string;
  type: PostingType;
  amount: number; // Must be positive
  createdAt?: Date;

  constructor(data: Partial<LedgerPosting>) {
    this.id = data.id || '';
    this.tenantId = data.tenantId || '';
    this.entryId = data.entryId || '';
    this.accountId = data.accountId || '';
    this.type = data.type || 'DEBIT';
    this.amount = data.amount || 0;
    this.createdAt = data.createdAt;
  }
}
