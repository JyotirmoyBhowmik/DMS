import { LedgerPosting } from './ledger-posting.entity.js';

export type LedgerEntryStatus = 'POSTED' | 'REVERSED';

export class LedgerEntry {
  id: string;
  tenantId: string;
  referenceType: string; // e.g. 'ORDER', 'CLAIM', 'SCHEME', 'MANUAL'
  referenceId: string;
  description: string;
  status: LedgerEntryStatus;
  reversedEntryId?: string | null;
  postedAt: Date;
  idempotencyKey: string;
  version: number;
  postings: LedgerPosting[];
  createdAt?: Date;
  updatedAt?: Date;

  constructor(data: Partial<LedgerEntry>) {
    this.id = data.id || '';
    this.tenantId = data.tenantId || '';
    this.referenceType = data.referenceType || '';
    this.referenceId = data.referenceId || '';
    this.description = data.description || '';
    this.status = data.status || 'POSTED';
    this.reversedEntryId = data.reversedEntryId;
    this.postedAt = data.postedAt || new Date();
    this.idempotencyKey = data.idempotencyKey || '';
    this.version = data.version || 1;
    this.postings = data.postings || [];
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }
}
