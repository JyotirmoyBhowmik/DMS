import { DebitNote } from '../entities/debit-note.entity.js';

export interface ListDebitNotesOptions {
  page?: number;
  limit?: number;
  status?: string;
  distributorId?: string;
  invoiceId?: string;
  search?: string;
  sortField?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface ListDebitNotesResult {
  data: DebitNote[];
  total: number;
  page: number;
  limit: number;
}

export interface DebitNoteRepository {
  save(debitNote: DebitNote, tenantId: string): Promise<DebitNote>;
  findById(id: string, tenantId: string): Promise<DebitNote | null>;
  findByDebitNoteNumber(debitNoteNumber: string, tenantId: string): Promise<DebitNote | null>;
  list(options: ListDebitNotesOptions, tenantId: string): Promise<ListDebitNotesResult>;
  update(debitNote: DebitNote, tenantId: string): Promise<DebitNote>;
  delete(id: string, tenantId: string): Promise<void>;
}
